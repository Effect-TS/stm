import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as stm from "@effect/stm/internal/stm"
import type * as Journal from "@effect/stm/internal/stm/journal"
import * as tArray from "@effect/stm/internal/tArray"
import * as tRef from "@effect/stm/internal/tRef"
import * as STM from "@effect/stm/STM"
import type * as TArray from "@effect/stm/TArray"
import type * as TMap from "@effect/stm/TMap"
import type * as TRef from "@effect/stm/TRef"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Equal from "@fp-ts/data/Equal"
import type { LazyArg } from "@fp-ts/data/Function"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const TMapSymbolKey = "@effect/stm/TMap"

/** @internal */
export const TMapTypeId: TMap.TMapTypeId = Symbol.for(
  TMapSymbolKey
) as TMap.TMapTypeId

/** @internal */
const tMapVariance = {
  _K: (_: never) => _,
  _V: (_: never) => _
}

/** @internal */
class TMapImpl<K, V> implements TMap.TMap<K, V> {
  readonly [TMapTypeId] = tMapVariance
  constructor(
    readonly tBuckets: TRef.TRef<TArray.TArray<Chunk.Chunk<readonly [K, V]>>>,
    readonly tSize: TRef.TRef<number>
  ) {}
}

/** @internal */
const InitialCapacity = 16
const LoadFactor = 0.75

/** @internal */
const nextPowerOfTwo = (size: number): number => {
  const n = -1 >>> Math.clz32(size - 1)
  return n < 0 ? 1 : n + 1
}

/** @internal */
const hash = <K>(key: K): number => {
  const h = Equal.hash(key)
  return h ^ (h >>> 16)
}

/** @internal */
const indexOf = <K>(k: K, capacity: number): number => hash(k) & (capacity - 1)

/**
 * @macro traced
 * @internal
 */
const allocate = <K, V>(
  capacity: number,
  data: Chunk.Chunk<readonly [K, V]>
): STM.STM<never, never, TMap.TMap<K, V>> => {
  const trace = getCallTrace()
  const buckets = Array.from({ length: capacity }, () => Chunk.empty<readonly [K, V]>())
  const distinct = new Map<K, V>(data)
  let size = 0
  for (const entry of distinct) {
    const index = indexOf(entry[0], capacity)
    buckets[index] = pipe(buckets[index], Chunk.prepend(entry))
    size = size + 1
  }
  return pipe(
    tArray.fromIterable(buckets),
    core.flatMap((buckets) =>
      pipe(
        tRef.make(buckets),
        core.flatMap((tBuckets) =>
          pipe(
            tRef.make(size),
            core.map((tSize) => new TMapImpl(tBuckets, tSize))
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
export const _delete = <K>(key: K) => {
  const trace = getCallTrace()
  return <V>(self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    core.effect<never, void>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      const index = indexOf(key, buckets.chunk.length)
      const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
      const [toRemove, toRetain] = pipe(bucket, Chunk.partition((entry) => Equal.equals(entry[1], key)))
      if (Chunk.isNonEmpty(toRemove)) {
        const currentSize = pipe(self.tSize, tRef.unsafeGet(journal))
        pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(toRetain, journal))
        pipe(self.tSize, tRef.unsafeSet(currentSize - 1, journal))
      }
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const deleteAll = <K>(keys: Iterable<K>) => {
  const trace = getCallTrace()
  return <V>(self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    core.effect<never, void>((journal) => {
      const iterator = keys[Symbol.iterator]()
      let next: IteratorResult<K, any>
      while ((next = iterator.next()) && !next.done) {
        const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
        const index = indexOf(next.value, buckets.chunk.length)
        const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        const [toRemove, toRetain] = pipe(
          bucket,
          Chunk.partition((entry) => Equal.equals(next.value)(entry[0]))
        )
        if (Chunk.isNonEmpty(toRemove)) {
          const currentSize = pipe(self.tSize, tRef.unsafeGet(journal))
          pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(toRetain, journal))
          pipe(self.tSize, tRef.unsafeSet(currentSize - 1, journal))
        }
      }
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const deleteIf = <K, V>(predicate: (key: K, value: V) => boolean) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<readonly [K, V]>> =>
    core.effect<never, Chunk.Chunk<readonly [K, V]>>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      const capacity = buckets.chunk.length
      const removed: Array<readonly [K, V]> = []
      let index = 0
      let newSize = 0
      while (index < capacity) {
        const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        const iterator = bucket[Symbol.iterator]()
        let next: IteratorResult<readonly [K, V], any>
        let newBucket = Chunk.empty<readonly [K, V]>()
        while ((next = iterator.next()) && !next.done) {
          if (!predicate(next.value[0], next.value[1])) {
            newBucket = pipe(newBucket, Chunk.prepend(next.value))
            newSize = newSize + 1
          } else {
            removed.push(next.value)
          }
        }
        pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBucket, journal))
        index = index + 1
      }
      pipe(self.tSize, tRef.unsafeSet(newSize, journal))
      return Chunk.unsafeFromArray(removed)
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const deleteIfDiscard = <K, V>(predicate: (key: K, value: V) => boolean) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    core.effect<never, void>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      const capacity = buckets.chunk.length
      let index = 0
      let newSize = 0
      while (index < capacity) {
        const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        const iterator = bucket[Symbol.iterator]()
        let next: IteratorResult<readonly [K, V], any>
        let newBucket = Chunk.empty<readonly [K, V]>()
        while ((next = iterator.next()) && !next.done) {
          if (!predicate(next.value[0], next.value[1])) {
            newBucket = pipe(newBucket, Chunk.prepend(next.value))
            newSize = newSize + 1
          }
        }
        pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBucket, journal))
        index = index + 1
      }
      pipe(self.tSize, tRef.unsafeSet(newSize, journal))
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const empty = <K, V>(): STM.STM<never, never, TMap.TMap<K, V>> => {
  const trace = getCallTrace()
  return fromIterable<K, V>([]).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const find = <K, V, A>(pf: (key: K, value: V) => Option.Option<A>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, Option.Option<A>> =>
    pipe(
      self,
      findSTM((key, value) => {
        const option = pf(key, value)
        if (Option.isSome(option)) {
          return core.succeed(option.value)
        }
        return core.fail(Option.none)
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findSTM = <K, V, R, E, A>(f: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<R, E, Option.Option<A>> =>
    pipe(
      self,
      reduceWithIndexSTM(
        Option.none as Option.Option<A>,
        (acc, value, key) =>
          Option.isNone(acc) ?
            pipe(
              f(key, value),
              core.foldSTM(
                Option.match(
                  () => stm.succeedNone(),
                  core.fail
                ),
                stm.succeedSome
              )
            ) :
            STM.succeed(acc)
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findAll = <K, V, A>(pf: (key: K, value: V) => Option.Option<A>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<A>> =>
    pipe(
      self,
      findAllSTM((key, value) => {
        const option = pf(key, value)
        if (Option.isSome(option)) {
          return core.succeed(option.value)
        }
        return core.fail(Option.none)
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findAllSTM = <K, V, R, E, A>(pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<R, E, Chunk.Chunk<A>> =>
    pipe(
      self,
      reduceWithIndexSTM(Chunk.empty<A>(), (acc, value, key) =>
        pipe(
          pf(key, value),
          core.foldSTM(
            Option.match(
              () => core.succeed(acc),
              core.fail
            ),
            (a) => core.succeed(pipe(acc, Chunk.append(a)))
          )
        ))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const forEach = <K, V, R, E, _>(f: (key: K, value: V) => STM.STM<R, E, _>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<R, E, void> =>
    pipe(
      self,
      reduceWithIndexSTM(void 0 as void, (_, value, key) => stm.asUnit(f(key, value)))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fromIterable = <K, V>(iterable: Iterable<readonly [K, V]>): STM.STM<never, never, TMap.TMap<K, V>> => {
  const trace = getCallTrace()
  return stm.suspend(() => {
    const data = Chunk.fromIterable(iterable)
    const capacity = data.length < InitialCapacity ? InitialCapacity : nextPowerOfTwo(data.length)
    return allocate(capacity, data)
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const get = <K>(key: K) => {
  const trace = getCallTrace()
  return <V>(self: TMap.TMap<K, V>): STM.STM<never, never, Option.Option<V>> =>
    core.effect<never, Option.Option<V>>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      const index = indexOf(key, buckets.chunk.length)
      const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
      return pipe(
        bucket,
        Chunk.findFirst((entry) => Equal.equals(entry[0])(key)),
        Option.map((entry) => entry[1])
      )
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const getOrElse = <K, V>(key: K, fallback: LazyArg<V>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, V> =>
    pipe(self, get(key), core.map(Option.getOrElse(fallback))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const has = <K>(key: K) => {
  const trace = getCallTrace()
  return <V>(self: TMap.TMap<K, V>): STM.STM<never, never, boolean> =>
    pipe(self, get(key), core.map(Option.isSome)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isEmpty = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.tSize), core.map((size) => size === 0)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const keys = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<K>> => {
  const trace = getCallTrace()
  return pipe(toChunk(self), core.map(Chunk.map((entry) => entry[0]))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const make = <K, V>(...entries: Array<readonly [K, V]>): STM.STM<never, never, TMap.TMap<K, V>> => {
  const trace = getCallTrace()
  return fromIterable(entries).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const merge = <K, V>(key: K, value: V, f: (x: V, y: V) => V) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, V> =>
    pipe(
      self,
      get(key),
      core.flatMap(Option.match(
        () => pipe(self, set(key, value), stm.as(value)),
        (v0) => {
          const v1 = f(v0, value)
          return pipe(self, set(key, v1), stm.as(v1))
        }
      ))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduce = <Z, V>(zero: Z, f: (acc: Z, value: V) => Z) => {
  const trace = getCallTrace()
  return <K>(self: TMap.TMap<K, V>): STM.STM<never, never, Z> =>
    pipe(self, reduceWithIndex(zero, (acc, value) => f(acc, value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceSTM = <Z, V, R, E>(zero: Z, f: (acc: Z, value: V) => STM.STM<R, E, Z>) => {
  const trace = getCallTrace()
  return <K>(self: TMap.TMap<K, V>): STM.STM<R, E, Z> =>
    pipe(self, reduceWithIndexSTM(zero, (acc, value) => f(acc, value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceWithIndex = <Z, K, V>(zero: Z, f: (acc: Z, value: V, key: K) => Z) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, Z> =>
    core.effect<never, Z>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      let result = zero
      let index = 0
      while (index < buckets.chunk.length) {
        const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index))
        const items = pipe(bucket, tRef.unsafeGet(journal))
        result = pipe(items, Chunk.reduce(result, (acc, entry) => f(acc, entry[1], entry[0])))
        index = index + 1
      }
      return result
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceWithIndexSTM = <Z, V, K, R, E>(zero: Z, f: (acc: Z, value: V, key: K) => STM.STM<R, E, Z>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<R, E, Z> =>
    pipe(
      toChunk(self),
      core.flatMap(stm.reduce(zero, (acc, entry) => f(acc, entry[1], entry[0])))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retainIf = <K, V>(predicate: (key: K, value: V) => boolean) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<readonly [K, V]>> =>
    pipe(self, deleteIf((key, value) => !predicate(key, value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retainIfDiscard = <K, V>(predicate: (key: K, value: V) => boolean) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    pipe(self, deleteIfDiscard((key, value) => !predicate(key, value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const set = <K, V>(key: K, value: V) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, void> => {
    const resize = (journal: Journal.Journal, buckets: TArray.TArray<Chunk.Chunk<readonly [K, V]>>): void => {
      const capacity = buckets.chunk.length
      const newCapacity = capacity << 1
      const newBuckets = Array.from({ length: newCapacity }, () => Chunk.empty<readonly [K, V]>())
      let index = 0
      while (index < capacity) {
        const pairs = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        const iterator = pairs[Symbol.iterator]()
        let next: IteratorResult<readonly [K, V], any>
        while ((next = iterator.next()) && !next.done) {
          const newIndex = indexOf(next.value[0], newCapacity)
          newBuckets[newIndex] = pipe(newBuckets[newIndex], Chunk.prepend(next.value))
        }
        index = index + 1
      }
      // insert new pair
      const newIndex = indexOf(key, newCapacity)
      newBuckets[newIndex] = pipe(newBuckets[newIndex], Chunk.prepend([key, value] as const))

      const newArray: Array<TRef.TRef<Chunk.Chunk<readonly [K, V]>>> = []
      index = 0
      while (index < newCapacity) {
        newArray[index] = new tRef.TRefImpl(newBuckets[index])
        index = index + 1
      }
      const newTArray: TArray.TArray<Chunk.Chunk<readonly [K, V]>> = new tArray.TArrayImpl(
        Chunk.unsafeFromArray(newArray)
      )
      pipe(self.tBuckets, tRef.unsafeSet(newTArray, journal))
    }
    return core.effect<never, void>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      const capacity = buckets.chunk.length
      const index = indexOf(key, capacity)
      const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
      const shouldUpdate = pipe(bucket, Chunk.some((entry) => Equal.equals(key)(entry[0])))
      if (shouldUpdate) {
        const newBucket = pipe(
          bucket,
          Chunk.map((entry) => Equal.equals(key)(entry[0]) ? [key, value] as const : entry)
        )
        pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBucket, journal))
      } else {
        const newSize = pipe(self.tSize, tRef.unsafeGet(journal)) + 1
        pipe(self.tSize, tRef.unsafeSet(newSize, journal))
        if (capacity * LoadFactor < newSize) {
          resize(journal, buckets)
        } else {
          const newBucket = pipe(bucket, Chunk.prepend([key, value] as const))
          pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBucket, journal))
        }
      }
    }).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const setIfAbsent = <K, V>(key: K, value: V) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    pipe(
      self,
      get(key),
      core.flatMap(Option.match(() => pipe(self, set(key, value)), stm.unit))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const size = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return tRef.get(self.tSize).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeFirst = <K, V, A>(pf: (key: K, value: V) => Option.Option<A>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, A> =>
    pipe(
      core.effect<never, Option.Option<A>>((journal) => {
        const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
        const capacity = buckets.chunk.length
        const size = pipe(self.tSize, tRef.unsafeGet(journal))
        let result: Option.Option<A> = Option.none
        let index = 0
        while (index < capacity && Option.isNone(result)) {
          const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
          const recreate = pipe(bucket, Chunk.some((entry) => Option.isSome(pf(entry[0], entry[1]))))
          if (recreate) {
            const iterator = bucket[Symbol.iterator]()
            let newBucket = Chunk.empty<readonly [K, V]>()
            let next: IteratorResult<readonly [K, V], any>
            while ((next = iterator.next()) && !next.done && Option.isNone(result)) {
              const option = pf(next.value[0], next.value[1])
              if (Option.isSome(option) && Option.isNone(result)) {
                result = option
              } else {
                newBucket = pipe(newBucket, Chunk.prepend(next.value))
              }
            }
            pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBucket, journal))
          }
          index = index + 1
        }
        if (Option.isSome(result)) {
          pipe(self.tSize, tRef.unsafeSet(size - 1, journal))
        }
        return result
      }),
      stm.collect((option) =>
        Option.isSome(option) ?
          Option.some(option.value) :
          Option.none
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeFirstSTM = <K, V, R, E, A>(pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<R, E, A> =>
    pipe(
      self,
      findSTM((key, value) => pipe(pf(key, value), core.map((a) => [key, a] as const))),
      stm.collect((option) => Option.isSome(option) ? Option.some(option.value) : Option.none),
      core.flatMap((entry) => pipe(self, _delete(entry[0]), stm.as(entry[1])))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toChunk = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<readonly [K, V]>> => {
  const trace = getCallTrace()
  return core.effect<never, Chunk.Chunk<readonly [K, V]>>((journal) => {
    const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
    const capacity = buckets.chunk.length
    const builder: Array<readonly [K, V]> = []
    let index = 0
    while (index < capacity) {
      const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index))
      builder.push(...pipe(bucket, tRef.unsafeGet(journal)))
      index = index + 1
    }
    return Chunk.unsafeFromArray(builder)
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toReadonlyArray = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, ReadonlyArray<readonly [K, V]>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    reduceWithIndex([] as ReadonlyArray<readonly [K, V]>, (acc, value, key) => [[key, value] as const, ...acc])
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toReadonlyMap = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, ReadonlyMap<K, V>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    reduceWithIndex(new Map<K, V>(), (acc, value, key) => acc.set(key, value))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transform = <K, V>(f: (key: K, value: V) => readonly [K, V]) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    core.effect<never, void>((journal) => {
      const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
      const capacity = buckets.chunk.length
      const newBuckets = Array.from({ length: capacity }, () => Chunk.empty<readonly [K, V]>())
      let newSize = 0
      let index = 0
      while (index < capacity) {
        const bucket = pipe(buckets.chunk, Chunk.unsafeGet(index))
        const pairs = pipe(bucket, tRef.unsafeGet(journal))
        const iterator = pairs[Symbol.iterator]()
        let next: IteratorResult<readonly [K, V], any>
        while ((next = iterator.next()) && !next.done) {
          const newPair = f(next.value[0], next.value[1])
          const index = indexOf(newPair[0], capacity)
          const newBucket = newBuckets[index]
          if (!pipe(newBucket, Chunk.some((entry) => Equal.equals(entry[0])(newPair[0])))) {
            newBuckets[index] = pipe(newBucket, Chunk.prepend(newPair))
            newSize = newSize + 1
          }
        }
        index = index + 1
      }
      index = 0
      while (index < capacity) {
        pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBuckets[index], journal))
        index = index + 1
      }
      pipe(self.tSize, tRef.unsafeSet(newSize, journal))
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transformSTM = <K, V, R, E>(f: (key: K, value: V) => STM.STM<R, E, readonly [K, V]>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<R, E, void> =>
    pipe(
      toChunk(self),
      core.flatMap(stm.forEach((entry) => f(entry[0], entry[1]))),
      core.flatMap((newData) =>
        core.effect<never, void>((journal) => {
          const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
          const capacity = buckets.chunk.length
          const newBuckets = Array.from({ length: capacity }, () => Chunk.empty<readonly [K, V]>())
          const iterator = newData[Symbol.iterator]()
          let newSize = 0
          let next: IteratorResult<readonly [K, V], any>
          while ((next = iterator.next()) && !next.done) {
            const index = indexOf(next.value[0], capacity)
            const newBucket = newBuckets[index]
            if (!pipe(newBucket, Chunk.some((entry) => Equal.equals(entry[0])(next.value[0])))) {
              newBuckets[index] = pipe(newBucket, Chunk.prepend(next.value))
              newSize = newSize + 1
            }
          }
          let index = 0
          while (index < capacity) {
            pipe(buckets.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(newBuckets[index], journal))
            index = index + 1
          }
          pipe(self.tSize, tRef.unsafeSet(newSize, journal))
        })
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transformValues = <V>(f: (value: V) => V) => {
  const trace = getCallTrace()
  return <K>(self: TMap.TMap<K, V>): STM.STM<never, never, void> =>
    pipe(self, transform((key, value) => [key, f(value)])).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transformValuesSTM = <V, R, E>(f: (value: V) => STM.STM<R, E, V>) => {
  const trace = getCallTrace()
  return <K>(self: TMap.TMap<K, V>): STM.STM<R, E, void> =>
    pipe(self, transformSTM((key, value) => pipe(f(value), core.map((value) => [key, value])))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const updateWith = <K, V>(key: K, f: (value: Option.Option<V>) => Option.Option<V>) => {
  const trace = getCallTrace()
  return (self: TMap.TMap<K, V>): STM.STM<never, never, Option.Option<V>> =>
    pipe(
      self,
      get(key),
      core.flatMap((option) =>
        pipe(
          f(option),
          Option.match(
            () => pipe(self, _delete(key), stm.as(Option.none)),
            (value) => pipe(self, set(key, value), stm.as(Option.some(value)))
          )
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const values = <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<V>> => {
  const trace = getCallTrace()
  return pipe(toChunk(self), core.map(Chunk.map((entry) => entry[1]))).traced(trace)
}
