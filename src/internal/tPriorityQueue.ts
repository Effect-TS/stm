import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as tRef from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TPriorityQueue from "@effect/stm/TPriorityQueue"
import type * as TRef from "@effect/stm/TRef"
import type * as Order from "@fp-ts/core/typeclass/Order"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"
import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray"
import * as SortedMap from "@fp-ts/data/SortedMap"

/** @internal */
const TPriorityQueueSymbolKey = "@effect/stm/TPriorityQueue"

/** @internal */
export const TPriorityQueueTypeId: TPriorityQueue.TPriorityQueueTypeId = Symbol.for(
  TPriorityQueueSymbolKey
) as TPriorityQueue.TPriorityQueueTypeId

/** @internal */
const tPriorityQueueVariance = {
  _A: (_: never) => _
}

/** @internal */
export class TPriorityQueueImpl<A> implements TPriorityQueue.TPriorityQueue<A> {
  readonly [TPriorityQueueTypeId] = tPriorityQueueVariance
  constructor(readonly ref: TRef.TRef<SortedMap.SortedMap<A, [A, ...Array<A>]>>) {}
}

/**
 * @macro traced
 * @internal
 */
export const empty = <A>(order: Order.Order<A>): STM.STM<never, never, TPriorityQueue.TPriorityQueue<A>> => {
  const trace = getCallTrace()
  return pipe(
    tRef.make(SortedMap.empty<A, [A, ...Array<A>]>(order)),
    core.map((ref) => new TPriorityQueueImpl(ref))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fromIterable = <A>(order: Order.Order<A>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<never, never, TPriorityQueue.TPriorityQueue<A>> =>
    pipe(
      tRef.make(
        Array.from(iterable).reduce(
          (map, value) =>
            pipe(
              map,
              SortedMap.set(
                value,
                pipe(
                  map,
                  SortedMap.get(value),
                  Option.match(() => ReadonlyArray.of(value), ReadonlyArray.prepend(value))
                )
              )
            ),
          SortedMap.empty<A, [A, ...Array<A>]>(order)
        )
      ),
      core.map((ref) => new TPriorityQueueImpl(ref))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isEmpty = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.ref), core.map(SortedMap.isEmpty)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isNonEmpty = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.ref), core.map(SortedMap.isNonEmpty)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const make = <A>(order: Order.Order<A>) => {
  const trace = getCallTrace()
  return (...elements: Array<A>): STM.STM<never, never, TPriorityQueue.TPriorityQueue<A>> =>
    fromIterable(order)(elements).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const offer = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, void> =>
    pipe(
      self.ref,
      tRef.update((map) =>
        pipe(
          map,
          SortedMap.set(
            value,
            pipe(
              map,
              SortedMap.get(value),
              Option.match(() => ReadonlyArray.of(value), ReadonlyArray.prepend(value))
            )
          )
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const offerAll = <A>(values: Iterable<A>) => {
  const trace = getCallTrace()
  return (self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, void> =>
    pipe(
      self.ref,
      tRef.update((map) =>
        Array.from(values).reduce(
          (map, value) =>
            pipe(
              map,
              SortedMap.set(
                value,
                pipe(
                  map,
                  SortedMap.get(value),
                  Option.match(() => ReadonlyArray.of(value), ReadonlyArray.prepend(value))
                )
              )
            ),
          map
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const peek = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  return core.withSTMRuntime((runtime) => {
    const map = pipe(self.ref, tRef.unsafeGet(runtime.journal))
    return pipe(
      SortedMap.headOption(map),
      Option.match(core.retry, (elements) => core.succeed(elements[0]))
    )
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const peekOption = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return pipe(
    self.ref,
    tRef.modify((map) => [
      pipe(SortedMap.headOption(map), Option.map((elements) => elements[0])),
      map
    ])
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const removeIf = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, void> =>
    pipe(self, retainIf((a) => !predicate(a))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retainIf = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, void> =>
    pipe(
      self.ref,
      tRef.update((map) =>
        pipe(
          map,
          SortedMap.reduceWithIndex(SortedMap.empty(SortedMap.getOrder(map)), (map, value, key) => {
            const filtered: ReadonlyArray<A> = pipe(value, ReadonlyArray.filter(predicate))
            return filtered.length > 0 ?
              pipe(map, SortedMap.set(key, filtered as [A, ...Array<A>])) :
              pipe(map, SortedMap.remove(key))
          })
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const size = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return pipe(
    self.ref,
    tRef.modify((map) => [pipe(map, SortedMap.reduce(0, (n, as) => n + as.length)), map])
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const take = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  return core.withSTMRuntime((runtime) => {
    const map = pipe(self.ref, tRef.unsafeGet(runtime.journal))
    return pipe(
      SortedMap.headOption(map),
      Option.match(
        core.retry,
        (values) => {
          const head = values[1][0]
          const tail = values[1].slice(1)
          pipe(
            self.ref,
            tRef.unsafeSet(
              tail.length > 0 ?
                pipe(map, SortedMap.set(head, tail as [A, ...Array<A>])) :
                pipe(map, SortedMap.remove(head)),
              runtime.journal
            )
          )
          return core.succeed(head)
        }
      )
    )
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeAll = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return pipe(
    self.ref,
    tRef.modify((map) => {
      const builder: Array<A> = []
      for (const entry of map) {
        builder.push(...entry[1])
      }
      return [Chunk.unsafeFromArray(builder), SortedMap.empty(SortedMap.getOrder(map))]
    })
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeOption = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return core.effect<never, Option.Option<A>>((journal) => {
    const map = pipe(self.ref, tRef.unsafeGet(journal))
    return pipe(
      SortedMap.headOption(map),
      Option.match(
        (): Option.Option<A> => Option.none,
        ([key, value]) => {
          const tail = value.slice(1)
          pipe(
            self.ref,
            tRef.unsafeSet(
              tail.length > 0 ?
                pipe(map, SortedMap.set(key, tail as [A, ...Array<A>])) :
                pipe(map, SortedMap.remove(key)),
              journal
            )
          )
          return Option.some(value[0])
        }
      )
    )
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeUpTo = (n: number) => {
  const trace = getCallTrace()
  return <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, Chunk.Chunk<A>> =>
    pipe(
      self.ref,
      tRef.modify((map) => {
        const builder: Array<A> = []
        const iterator = map[Symbol.iterator]()
        let updated = map
        let index = 0
        let next: IteratorResult<readonly [A, [A, ...Array<A>]], any>
        while ((next = iterator.next()) && !next.done && index < n) {
          const [key, value] = next.value
          const [left, right] = pipe(value, ReadonlyArray.splitAt(n - index))
          builder.push(...left)
          if (right.length > 0) {
            updated = pipe(updated, SortedMap.set(key, right as [A, ...Array<A>]))
          } else {
            updated = pipe(updated, SortedMap.remove(key))
          }
          index = index + left.length
        }
        return [Chunk.unsafeFromArray(builder), updated]
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toChunk = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return pipe(
    self.ref,
    tRef.modify((map) => {
      const builder: Array<A> = []
      for (const entry of map) {
        builder.push(...entry[1])
      }
      return [Chunk.unsafeFromArray(builder), map]
    })
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toReadonlyArray = <A>(self: TPriorityQueue.TPriorityQueue<A>): STM.STM<never, never, ReadonlyArray<A>> => {
  const trace = getCallTrace()
  return pipe(
    self.ref,
    tRef.modify((map) => {
      const builder: Array<A> = []
      for (const entry of map) {
        builder.push(...entry[1])
      }
      return [builder, map]
    })
  ).traced(trace)
}
