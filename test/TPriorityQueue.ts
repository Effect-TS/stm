import * as Effect from "@effect/io/Effect"
import * as STM from "@effect/stm/STM"
import * as it from "@effect/stm/test/utils/extend"
import * as TPriorityQueue from "@effect/stm/TPriorityQueue"
import * as Order from "@fp-ts/core/typeclass/Order"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as number from "@fp-ts/data/Number"
import * as Option from "@fp-ts/data/Option"
import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray"
import * as fc from "fast-check"
import { assert, describe } from "vitest"

interface Event {
  readonly time: number
  readonly description: string
}

const orderByTime: Order.Order<Event> = pipe(
  number.Order,
  Order.contramap((event) => event.time)
)

const eventArb: fc.Arbitrary<Event> = fc.tuple(
  fc.integer({ min: -10, max: 10 }),
  fc.string({ minLength: 1 })
).map(([time, description]) => ({ time, description }))

const eventsArb: fc.Arbitrary<Array<Event>> = fc.array(eventArb)

const predicateArb: fc.Arbitrary<(event: Event) => boolean> = fc.func(fc.boolean())

describe.concurrent("TPriorityQueue", () => {
  it.it("isEmpty", () =>
    fc.assert(fc.asyncProperty(eventsArb, async (events) => {
      const transaction = pipe(
        TPriorityQueue.empty<Event>(orderByTime),
        STM.tap(TPriorityQueue.offerAll(events)),
        STM.flatMap(TPriorityQueue.isEmpty)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.strictEqual(result, events.length === 0)
    })))

  it.it("isNonEmpty", () =>
    fc.assert(fc.asyncProperty(eventsArb, async (events) => {
      const transaction = pipe(
        TPriorityQueue.empty<Event>(orderByTime),
        STM.tap(TPriorityQueue.offerAll(events)),
        STM.flatMap(TPriorityQueue.isNonEmpty)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.strictEqual(result, events.length > 0)
    })))

  it.it("offerAll and takeAll", () =>
    fc.assert(fc.asyncProperty(eventsArb, async (events) => {
      const transaction = pipe(
        TPriorityQueue.empty<Event>(orderByTime),
        STM.tap(TPriorityQueue.offerAll(events)),
        STM.flatMap(TPriorityQueue.takeAll),
        STM.map((chunk) => Array.from(chunk))
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(events)), 0)
      assert.lengthOf(pipe(events, ReadonlyArray.difference(result)), 0)
      assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
    })))

  it.it("removeIf", () =>
    fc.assert(fc.asyncProperty(eventsArb, predicateArb, async (events, f) => {
      const transaction = pipe(
        TPriorityQueue.fromIterable(orderByTime)(events),
        STM.tap(TPriorityQueue.removeIf(f)),
        STM.flatMap(TPriorityQueue.toReadonlyArray)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      const filtered = pipe(events, ReadonlyArray.filter((a) => !f(a)))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(filtered)), 0)
      assert.lengthOf(pipe(filtered, ReadonlyArray.difference(result)), 0)
      assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
    })))

  it.it("retainIf", () =>
    fc.assert(fc.asyncProperty(eventsArb, predicateArb, async (events, f) => {
      const transaction = pipe(
        TPriorityQueue.fromIterable(orderByTime)(events),
        STM.tap(TPriorityQueue.retainIf(f)),
        STM.flatMap(TPriorityQueue.toReadonlyArray)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      const filtered = pipe(events, ReadonlyArray.filter(f))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(filtered)), 0)
      assert.lengthOf(pipe(filtered, ReadonlyArray.difference(result)), 0)
      assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
    })))

  it.it("take", () =>
    fc.assert(fc.asyncProperty(eventsArb, async (events) => {
      const transaction = pipe(
        TPriorityQueue.fromIterable(orderByTime)(events),
        STM.flatMap((queue) =>
          STM.collectAll(pipe(
            TPriorityQueue.take(queue),
            STM.replicate(events.length)
          ))
        ),
        STM.map((chunk) => Array.from(chunk))
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(events)), 0)
      assert.lengthOf(pipe(events, ReadonlyArray.difference(result)), 0)
      assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
    })))

  it.it("takeOption", () =>
    fc.assert(
      fc.asyncProperty(eventsArb.filter((events) => events.length > 0), async (events) => {
        const transaction = pipe(
          TPriorityQueue.fromIterable(orderByTime)(events),
          STM.flatMap((queue) =>
            pipe(
              TPriorityQueue.takeOption(queue),
              STM.tap(() => TPriorityQueue.takeAll(queue)),
              STM.flatMap((left) =>
                pipe(
                  TPriorityQueue.takeOption(queue),
                  STM.map((right) => [left, right] as const)
                )
              )
            )
          )
        )
        const result = await Effect.unsafeRunPromise(STM.commit(transaction))
        assert.isTrue(Option.isSome(result[0]))
        assert.isTrue(Option.isNone(result[1]))
      })
    ))

  it.it("takeUpTo", () =>
    fc.assert(
      fc.asyncProperty(
        eventsArb.chain((events) => fc.tuple(fc.constant(events), fc.integer({ min: 0, max: events.length }))),
        async ([events, n]) => {
          const transaction = pipe(
            TPriorityQueue.fromIterable(orderByTime)(events),
            STM.flatMap((queue) =>
              pipe(
                queue,
                TPriorityQueue.takeUpTo(n),
                STM.flatMap((left) =>
                  pipe(
                    TPriorityQueue.takeAll(queue),
                    STM.map((right) => Array.from(pipe(left, Chunk.concat(right))))
                  )
                )
              )
            )
          )
          const result = await Effect.unsafeRunPromise(STM.commit(transaction))
          assert.lengthOf(pipe(result, ReadonlyArray.difference(events)), 0)
          assert.lengthOf(pipe(events, ReadonlyArray.difference(result)), 0)
          assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
        }
      )
    ))

  it.it("toChunk", () =>
    fc.assert(fc.asyncProperty(eventsArb, async (events) => {
      const transaction = pipe(
        TPriorityQueue.fromIterable(orderByTime)(events),
        STM.flatMap(TPriorityQueue.toChunk),
        STM.map((chunk) => Array.from(chunk))
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(events)), 0)
      assert.lengthOf(pipe(events, ReadonlyArray.difference(result)), 0)
      assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
    })))

  it.it("toReadonlyArray", () =>
    fc.assert(fc.asyncProperty(eventsArb, async (events) => {
      const transaction = pipe(
        TPriorityQueue.fromIterable(orderByTime)(events),
        STM.flatMap(TPriorityQueue.toReadonlyArray)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(events)), 0)
      assert.lengthOf(pipe(events, ReadonlyArray.difference(result)), 0)
      assert.deepStrictEqual(result, pipe(result, ReadonlyArray.sort(orderByTime)))
    })))
})
