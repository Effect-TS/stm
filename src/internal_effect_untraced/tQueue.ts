import * as Chunk from "@effect/data/Chunk"
import * as Debug from "@effect/io/Debug"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as OpCodes from "@effect/stm/internal_effect_untraced/opCodes/strategy"
import * as stm from "@effect/stm/internal_effect_untraced/stm"
import * as tRef from "@effect/stm/internal_effect_untraced/tRef"
import * as STM from "@effect/stm/STM"
import type * as TQueue from "@effect/stm/TQueue"
import type * as TRef from "@effect/stm/TRef"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import type { Predicate } from "@effect/data/Predicate"

const TEnqueueSymbolKey = "@effect/stm/TQueue/TEnqueue"

/** @internal */
export const TEnqueueTypeId: TQueue.TEnqueueTypeId = Symbol.for(TEnqueueSymbolKey) as TQueue.TEnqueueTypeId

const TDequeueSymbolKey = "@effect/stm/TQueue/TDequeue"

/** @internal */
export const TDequeueTypeId: TQueue.TDequeueTypeId = Symbol.for(TDequeueSymbolKey) as TQueue.TDequeueTypeId

/**
 * A `Strategy` describes how the queue will handle values if the queue is at
 * capacity.
 *
 * @internal
 */
export type TQueueStrategy = BackPressure | Dropping | Sliding

/**
 * A strategy that retries if the queue is at capacity.
 *
 * @internal
 */
export interface BackPressure {
  readonly _tag: OpCodes.OP_BACKPRESSURE_STRATEGY
}

/**
 * A strategy that drops new values if the queue is at capacity.
 *
 * @internal
 */
export interface Dropping {
  readonly _tag: OpCodes.OP_DROPPING_STRATEGY
}

/**
 * A strategy that drops old values if the queue is at capacity.
 *
 * @internal
 */
export interface Sliding {
  readonly _tag: OpCodes.OP_SLIDING_STRATEGY
}

/** @internal */
export const BackPressure: TQueueStrategy = {
  _tag: OpCodes.OP_BACKPRESSURE_STRATEGY
}

/** @internal */
export const Dropping: TQueueStrategy = {
  _tag: OpCodes.OP_DROPPING_STRATEGY
}

/** @internal */
export const Sliding: TQueueStrategy = {
  _tag: OpCodes.OP_SLIDING_STRATEGY
}

/** @internal */
export const tDequeueVariance = {
  _Out: (_: never) => _
}

/** @internal */
export const tEnqueueVariance = {
  _In: (_: unknown) => _
}

class TQueueImpl<A> implements TQueue.TQueue<A> {
  readonly [TDequeueTypeId] = tDequeueVariance
  readonly [TEnqueueTypeId] = tEnqueueVariance
  constructor(
    readonly ref: TRef.TRef<Array<A> | undefined>,
    readonly requestedCapacity: number,
    readonly strategy: TQueueStrategy
  ) {}

  capacity(): number {
    return this.requestedCapacity
  }

  size(): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return STM.interruptAs(runtime.fiberId)
        }
        return core.succeed(queue.length)
      }).traced(trace)
    )
  }

  isFull(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.map(this.size(), (size) => size === this.requestedCapacity).traced(trace)
    )
  }

  isEmpty(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.map(this.size(), (size) => size === 0).traced(trace))
  }

  shutdown(): STM.STM<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime<never, never, void>((runtime) => {
        tRef.unsafeSet(this.ref, void 0, runtime.journal)
        return stm.unit()
      }).traced(trace)
    )
  }

  isShutdown(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.effect<never, boolean>((journal) => {
        const queue = tRef.unsafeGet(this.ref, journal)
        return queue === undefined
      }).traced(trace)
    )
  }

  awaitShutdown(): STM.STM<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.flatMap(
        this.isShutdown(),
        (isShutdown) => isShutdown ? stm.unit() : core.retry()
      ).traced(trace)
    )
  }

  offer(value: A): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        if (queue.length < this.requestedCapacity) {
          queue.push(value)
          tRef.unsafeSet(this.ref, queue, runtime.journal)
          return core.succeed(true)
        }
        switch (this.strategy._tag) {
          case OpCodes.OP_BACKPRESSURE_STRATEGY: {
            return core.retry()
          }
          case OpCodes.OP_DROPPING_STRATEGY: {
            return core.succeed(false)
          }
          case OpCodes.OP_SLIDING_STRATEGY: {
            const dequeued = queue.shift()
            if (dequeued === undefined) {
              return core.succeed(true)
            }
            queue.push(value)
            tRef.unsafeSet(this.ref, queue, runtime.journal)
            return core.succeed(true)
          }
        }
      }).traced(trace)
    )
  }

  offerAll(iterable: Iterable<A>): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const as = Array.from(iterable)
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        if (queue.length + as.length <= this.requestedCapacity) {
          tRef.unsafeSet(this.ref, [...queue, ...as], runtime.journal)
          return core.succeed(true)
        }
        switch (this.strategy._tag) {
          case OpCodes.OP_BACKPRESSURE_STRATEGY: {
            return core.retry()
          }
          case OpCodes.OP_DROPPING_STRATEGY: {
            const forQueue = as.slice(0, this.requestedCapacity - queue.length)
            tRef.unsafeSet(this.ref, [...queue, ...forQueue], runtime.journal)
            return core.succeed(false)
          }
          case OpCodes.OP_SLIDING_STRATEGY: {
            const forQueue = as.slice(0, this.requestedCapacity - queue.length)
            const toDrop = queue.length + forQueue.length - this.requestedCapacity
            const newQueue = queue.slice(toDrop)
            tRef.unsafeSet(this.ref, [...newQueue, ...forQueue], runtime.journal)
            return core.succeed(true)
          }
        }
      }).traced(trace)
    )
  }

  peek(): STM.STM<never, never, A> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        const head = queue[0]
        if (head === undefined) {
          return core.retry()
        }
        return core.succeed(head)
      }).traced(trace)
    )
  }

  peekOption(): STM.STM<never, never, Option.Option<A>> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        return core.succeed(Option.fromNullable(queue[0]))
      }).traced(trace)
    )
  }

  take(): STM.STM<never, never, A> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        const dequeued = queue.shift()
        if (dequeued === undefined) {
          return core.retry()
        }
        tRef.unsafeSet(this.ref, queue, runtime.journal)
        return core.succeed(dequeued)
      }).traced(trace)
    )
  }

  takeAll(): STM.STM<never, never, Chunk.Chunk<A>> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        tRef.unsafeSet(this.ref, [], runtime.journal)
        return core.succeed(Chunk.unsafeFromArray(queue))
      }).traced(trace)
    )
  }

  takeUpTo(max: number): STM.STM<never, never, Chunk.Chunk<A>> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const queue = tRef.unsafeGet(this.ref, runtime.journal)
        if (queue === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        const [toTake, remaining] = Chunk.splitAt(Chunk.unsafeFromArray(queue), max)
        tRef.unsafeSet<Array<A> | undefined>(this.ref, Array.from(remaining), runtime.journal)
        return core.succeed(toTake)
      }).traced(trace)
    )
  }
}

/** @internal */
export const isTQueue = (u: unknown): u is TQueue.TQueue<unknown> => {
  return isTEnqueue(u) && isTDequeue(u)
}

/** @internal */
export const isTEnqueue = (u: unknown): u is TQueue.TEnqueue<unknown> => {
  return typeof u === "object" && u != null && TEnqueueTypeId in u
}

/** @internal */
export const isTDequeue = (u: unknown): u is TQueue.TDequeue<unknown> => {
  return typeof u === "object" && u != null && TDequeueTypeId in u
}

/** @internal */
export const awaitShutdown = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, void> => self.awaitShutdown().traced(trace)
)

/** @internal */
export const bounded = Debug.methodWithTrace((trace) =>
  <A>(requestedCapacity: number): STM.STM<never, never, TQueue.TQueue<A>> =>
    makeQueue<A>(requestedCapacity, BackPressure).traced(trace)
)

/** @internal */
export const capacity = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): number => {
  return self.capacity()
}

/** @internal */
export const dropping = Debug.methodWithTrace((trace) =>
  <A>(requestedCapacity: number): STM.STM<never, never, TQueue.TQueue<A>> =>
    makeQueue<A>(requestedCapacity, Dropping).traced(trace)
)

/** @internal */
export const isEmpty = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => self.isEmpty().traced(trace)
)

/** @internal */
export const isFull = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => self.isFull().traced(trace)
)

/** @internal */
export const isShutdown = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => self.isShutdown().traced(trace)
)

/** @internal */
export const offer = Debug.dualWithTrace<
  <A>(value: A) => (self: TQueue.TEnqueue<A>) => STM.STM<never, never, void>,
  <A>(self: TQueue.TEnqueue<A>, value: A) => STM.STM<never, never, void>
>(2, (trace) => (self, value) => self.offer(value).traced(trace))

/** @internal */
export const offerAll = Debug.dualWithTrace<
  <A>(iterable: Iterable<A>) => (self: TQueue.TEnqueue<A>) => STM.STM<never, never, boolean>,
  <A>(self: TQueue.TEnqueue<A>, iterable: Iterable<A>) => STM.STM<never, never, boolean>
>(2, (trace) => (self, iterable) => self.offerAll(iterable).traced(trace))

/** @internal */
export const peek = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, A> => self.peek().traced(trace)
)

/** @internal */
export const peekOption = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Option.Option<A>> => self.peekOption().traced(trace)
)

/** @internal */
export const poll = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Option.Option<A>> =>
    pipe(self.takeUpTo(1), core.map(Chunk.head)).traced(trace)
)

/** @internal */
export const seek = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TQueue.TDequeue<A>) => STM.STM<never, never, A>,
  <A>(self: TQueue.TDequeue<A>, predicate: Predicate<A>) => STM.STM<never, never, A>
>(2, (trace, restore) => (self, predicate) => seekLoop(self, restore(predicate)).traced(trace))

const seekLoop = <A>(self: TQueue.TDequeue<A>, predicate: Predicate<A>): STM.STM<never, never, A> =>
  core.flatMap(
    self.take(),
    (a) => predicate(a) ? core.succeed(a) : seekLoop(self, predicate)
  )

/** @internal */
export const shutdown = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, void> => self.shutdown().traced(trace)
)

/** @internal */
export const size = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, number> => self.size().traced(trace)
)

/** @internal */
export const sliding = Debug.methodWithTrace((trace) =>
  <A>(requestedCapacity: number): STM.STM<never, never, TQueue.TQueue<A>> =>
    makeQueue<A>(requestedCapacity, Sliding).traced(trace)
)

/** @internal */
export const take = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, A> => self.take().traced(trace)
)

/** @internal */
export const takeAll = Debug.methodWithTrace((trace) =>
  <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Chunk.Chunk<A>> => self.takeAll().traced(trace)
)

/** @internal */
export const takeBetween = Debug.dualWithTrace<
  (min: number, max: number) => <A>(self: TQueue.TDequeue<A>) => STM.STM<never, never, Chunk.Chunk<A>>,
  <A>(self: TQueue.TDequeue<A>, min: number, max: number) => STM.STM<never, never, Chunk.Chunk<A>>
>(
  3,
  (trace) =>
    <A>(self: TQueue.TDequeue<A>, min: number, max: number): STM.STM<never, never, Chunk.Chunk<A>> =>
      stm.suspend(() => {
        const takeRemainder = (
          min: number,
          max: number,
          acc: Chunk.Chunk<A>
        ): STM.STM<never, never, Chunk.Chunk<A>> => {
          if (max < min) {
            return core.succeed(acc).traced(trace)
          }
          return pipe(
            self.takeUpTo(max),
            core.flatMap((taken) => {
              const remaining = min - taken.length
              if (remaining === 1) {
                return pipe(
                  self.take(),
                  core.map((a) => pipe(acc, Chunk.concat(taken), Chunk.append(a)))
                )
              }
              if (remaining > 1) {
                return pipe(
                  self.take(),
                  core.flatMap((a) =>
                    takeRemainder(
                      remaining - 1,
                      max - taken.length - 1,
                      pipe(acc, Chunk.concat(taken), Chunk.append(a))
                    )
                  )
                )
              }
              return core.succeed(pipe(acc, Chunk.concat(taken)))
            })
          )
        }
        return takeRemainder(min, max, Chunk.empty<A>())
      }).traced(trace)
)

/** @internal */
export const takeN = Debug.dualWithTrace<
  (n: number) => <A>(self: TQueue.TDequeue<A>) => STM.STM<never, never, Chunk.Chunk<A>>,
  <A>(self: TQueue.TDequeue<A>, n: number) => STM.STM<never, never, Chunk.Chunk<A>>
>(2, (trace) => (self, n) => pipe(self, takeBetween(n, n)).traced(trace))

/** @internal */
export const takeUpTo = Debug.dualWithTrace<
  (max: number) => <A>(self: TQueue.TDequeue<A>) => STM.STM<never, never, Chunk.Chunk<A>>,
  <A>(self: TQueue.TDequeue<A>, max: number) => STM.STM<never, never, Chunk.Chunk<A>>
>(2, (trace) => (self, max) => self.takeUpTo(max).traced(trace))

/** @internal */
export const unbounded = Debug.methodWithTrace((trace) =>
  <A>(): STM.STM<never, never, TQueue.TQueue<A>> => makeQueue<A>(Number.MAX_SAFE_INTEGER, Dropping).traced(trace)
)

const makeQueue = <A>(requestedCapacity: number, strategy: TQueueStrategy): STM.STM<never, never, TQueue.TQueue<A>> =>
  core.map(
    tRef.make<Array<A>>([]),
    (ref) => new TQueueImpl(ref, requestedCapacity, strategy)
  )
