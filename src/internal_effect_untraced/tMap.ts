import * as Chunk from "@effect/data/Chunk"
import * as Equal from "@effect/data/Equal"
import * as Hash from "@effect/data/Hash"
import * as HashMap from "@effect/data/HashMap"
import * as Debug from "@effect/io/Debug"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as stm from "@effect/stm/internal_effect_untraced/stm"
import type * as Journal from "@effect/stm/internal_effect_untraced/stm/journal"
import * as tArray from "@effect/stm/internal_effect_untraced/tArray"
import * as tRef from "@effect/stm/internal_effect_untraced/tRef"
import * as STM from "@effect/stm/STM"
import type * as TArray from "@effect/stm/TArray"
import type * as TMap from "@effect/stm/TMap"
import type * as TRef from "@effect/stm/TRef"
import type { LazyArg } from "@fp-ts/core/Function"
import { pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"

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
  const h = Hash.hash(key)
  return h ^ (h >>> 16)
}

/** @internal */
const indexOf = <K>(k: K, capacity: number): number => hash(k) & (capacity - 1)

/** @internal */
const allocate = <K, V>(
  capacity: number,
  data: Chunk.Chunk<readonly [K, V]>
): STM.STM<never, never, TMap.TMap<K, V>> => {
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
  )
}

/** @internal */
export const empty = Debug.methodWithTrace((trace) =>
  <K, V>(): STM.STM<never, never, TMap.TMap<K, V>> => fromIterable<K, V>([]).traced(trace)
)

/** @internal */
export const find = Debug.dualWithTrace<
  <K, V, A>(
    pf: (key: K, value: V) => Option.Option<A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Option.Option<A>>,
  <K, V, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => Option.Option<A>
  ) => STM.STM<never, never, Option.Option<A>>
>(2, (trace, restore) =>
  (self, pf) =>
    findSTM(self, (key, value) => {
      const option = restore(pf)(key, value)
      if (Option.isSome(option)) {
        return core.succeed(option.value)
      }
      return core.fail(Option.none())
    }).traced(trace))

/** @internal */
export const findSTM = Debug.dualWithTrace<
  <K, V, R, E, A>(
    f: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<R, E, Option.Option<A>>,
  <K, V, R, E, A>(
    self: TMap.TMap<K, V>,
    f: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => STM.STM<R, E, Option.Option<A>>
>(2, (trace, restore) =>
  <K, V, R, E, A>(
    self: TMap.TMap<K, V>,
    f: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) =>
    reduceWithIndexSTM(self, Option.none<A>(), (acc, value, key) =>
      Option.isNone(acc) ?
        core.matchSTM(
          restore(f)(key, value),
          Option.match(
            stm.succeedNone,
            core.fail
          ),
          stm.succeedSome
        ) :
        STM.succeed(acc)).traced(trace))

/** @internal */
export const findAll = Debug.dualWithTrace<
  <K, V, A>(
    pf: (key: K, value: V) => Option.Option<A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Chunk.Chunk<A>>,
  <K, V, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => Option.Option<A>
  ) => STM.STM<never, never, Chunk.Chunk<A>>
>(2, (trace, restore) =>
  (self, pf) =>
    findAllSTM(self, (key, value) => {
      const option = restore(pf)(key, value)
      if (Option.isSome(option)) {
        return core.succeed(option.value)
      }
      return core.fail(Option.none())
    }).traced(trace))

/** @internal */
export const findAllSTM = Debug.dualWithTrace<
  <K, V, R, E, A>(
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<R, E, Chunk.Chunk<A>>,
  <K, V, R, E, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => STM.STM<R, E, Chunk.Chunk<A>>
>(2, (trace, restore) =>
  <K, V, R, E, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) =>
    reduceWithIndexSTM(self, Chunk.empty<A>(), (acc, value, key) =>
      core.matchSTM(
        restore(pf)(key, value),
        Option.match(
          () => core.succeed(acc),
          core.fail
        ),
        (a) => core.succeed(Chunk.append(acc, a))
      )).traced(trace))

/** @internal */
export const forEach = Debug.dualWithTrace<
  <K, V, R, E, _>(f: (key: K, value: V) => STM.STM<R, E, _>) => (self: TMap.TMap<K, V>) => STM.STM<R, E, void>,
  <K, V, R, E, _>(self: TMap.TMap<K, V>, f: (key: K, value: V) => STM.STM<R, E, _>) => STM.STM<R, E, void>
>(2, (trace, restore) =>
  (self, f) =>
    reduceWithIndexSTM(
      self,
      void 0 as void,
      (_, value, key) => stm.asUnit(restore(f)(key, value))
    ).traced(trace))

/** @internal */
export const fromIterable = Debug.methodWithTrace((trace) =>
  <K, V>(iterable: Iterable<readonly [K, V]>): STM.STM<never, never, TMap.TMap<K, V>> =>
    stm.suspend(() => {
      const data = Chunk.fromIterable(iterable)
      const capacity = data.length < InitialCapacity
        ? InitialCapacity
        : nextPowerOfTwo(data.length)
      return allocate(capacity, data)
    }).traced(trace)
)

/** @internal */
export const get = Debug.dualWithTrace<
  <K>(key: K) => <V>(self: TMap.TMap<K, V>) => STM.STM<never, never, Option.Option<V>>,
  <K, V>(self: TMap.TMap<K, V>, key: K) => STM.STM<never, never, Option.Option<V>>
>(2, (trace) =>
  <K, V>(self: TMap.TMap<K, V>, key: K) =>
    core.effect<never, Option.Option<V>>((journal) => {
      const buckets = tRef.unsafeGet(self.tBuckets, journal)
      const index = indexOf(key, buckets.chunk.length)
      const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
      return pipe(
        Chunk.findFirst(bucket, (entry) => Equal.equals(entry[0])(key)),
        Option.map((entry) => entry[1])
      )
    }).traced(trace))

/** @internal */
export const getOrElse = Debug.dualWithTrace<
  <K, V>(key: K, fallback: LazyArg<V>) => (self: TMap.TMap<K, V>) => STM.STM<never, never, V>,
  <K, V>(self: TMap.TMap<K, V>, key: K, fallback: LazyArg<V>) => STM.STM<never, never, V>
>(3, (trace, restore) =>
  (self, key, fallback) =>
    core.map(
      get(self, key),
      Option.getOrElse(restore(fallback))
    ).traced(trace))

/** @internal */
export const has = Debug.dualWithTrace<
  <K>(key: K) => <V>(self: TMap.TMap<K, V>) => STM.STM<never, never, boolean>,
  <K, V>(self: TMap.TMap<K, V>, key: K) => STM.STM<never, never, boolean>
>(2, (trace) => (self, key) => core.map(get(self, key), Option.isSome).traced(trace))

/** @internal */
export const isEmpty = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, boolean> =>
    core.map(tRef.get(self.tSize), (size) => size === 0).traced(trace)
)

/** @internal */
export const keys = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<K>> =>
    core.map(toChunk(self), Chunk.map((entry) => entry[0])).traced(trace)
)

/** @internal */
export const make = Debug.methodWithTrace((trace) =>
  <K, V>(...entries: Array<readonly [K, V]>): STM.STM<never, never, TMap.TMap<K, V>> =>
    fromIterable(entries).traced(trace)
)

/** @internal */
export const merge = Debug.dualWithTrace<
  <K, V>(key: K, value: V, f: (x: V, y: V) => V) => (self: TMap.TMap<K, V>) => STM.STM<never, never, V>,
  <K, V>(self: TMap.TMap<K, V>, key: K, value: V, f: (x: V, y: V) => V) => STM.STM<never, never, V>
>(4, (trace, restore) =>
  (self, key, value, f) =>
    core.flatMap(
      get(self, key),
      Option.match(
        () => stm.as(set(self, key, value), value),
        (v0) => {
          const v1 = restore(f)(v0, value)
          return stm.as(set(self, key, v1), v1)
        }
      )
    ).traced(trace))

/** @internal */
export const reduce = Debug.dualWithTrace<
  <Z, V>(zero: Z, f: (acc: Z, value: V) => Z) => <K>(self: TMap.TMap<K, V>) => STM.STM<never, never, Z>,
  <K, V, Z>(self: TMap.TMap<K, V>, zero: Z, f: (acc: Z, value: V) => Z) => STM.STM<never, never, Z>
>(3, (trace, restore) =>
  (self, zero, f) =>
    reduceWithIndex(
      self,
      zero,
      (acc, value) => restore(f)(acc, value)
    ).traced(trace))

/** @internal */
export const reduceSTM = Debug.dualWithTrace<
  <Z, V, R, E>(zero: Z, f: (acc: Z, value: V) => STM.STM<R, E, Z>) => <K>(self: TMap.TMap<K, V>) => STM.STM<R, E, Z>,
  <K, V, Z, R, E>(self: TMap.TMap<K, V>, zero: Z, f: (acc: Z, value: V) => STM.STM<R, E, Z>) => STM.STM<R, E, Z>
>(3, (trace, restore) =>
  (self, zero, f) =>
    reduceWithIndexSTM(
      self,
      zero,
      (acc, value) => restore(f)(acc, value)
    ).traced(trace))

/** @internal */
export const reduceWithIndex = Debug.dualWithTrace<
  <Z, K, V>(zero: Z, f: (acc: Z, value: V, key: K) => Z) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Z>,
  <K, V, Z>(self: TMap.TMap<K, V>, zero: Z, f: (acc: Z, value: V, key: K) => Z) => STM.STM<never, never, Z>
>(
  3,
  (trace, restore) =>
    <K, V, Z>(self: TMap.TMap<K, V>, zero: Z, f: (acc: Z, value: V, key: K) => Z) =>
      core.effect<never, Z>((journal) => {
        const buckets = tRef.unsafeGet(self.tBuckets, journal)
        let result = zero
        let index = 0
        while (index < buckets.chunk.length) {
          const bucket = Chunk.unsafeGet(buckets.chunk, index)
          const items = tRef.unsafeGet(bucket, journal)
          result = Chunk.reduce(items, result, (acc, entry) => restore(f)(acc, entry[1], entry[0]))
          index = index + 1
        }
        return result
      }).traced(trace)
)

/** @internal */
export const reduceWithIndexSTM = Debug.dualWithTrace<
  <Z, V, K, R, E>(
    zero: Z,
    f: (acc: Z, value: V, key: K) => STM.STM<R, E, Z>
  ) => (self: TMap.TMap<K, V>) => STM.STM<R, E, Z>,
  <Z, V, K, R, E>(
    self: TMap.TMap<K, V>,
    zero: Z,
    f: (acc: Z, value: V, key: K) => STM.STM<R, E, Z>
  ) => STM.STM<R, E, Z>
>(3, (trace, restore) =>
  (self, zero, f) =>
    core.flatMap(
      toChunk(self),
      stm.reduce(zero, (acc, entry) => restore(f)(acc, entry[1], entry[0]))
    ).traced(trace))

/** @internal */
export const remove = Debug.dualWithTrace<
  <K>(key: K) => <V>(self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, key: K) => STM.STM<never, never, void>
>(2, (trace) =>
  (self, key) =>
    core.effect<never, void>((journal) => {
      const buckets = tRef.unsafeGet(self.tBuckets, journal)
      const index = indexOf(key, buckets.chunk.length)
      const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
      const [toRemove, toRetain] = Chunk.partition(bucket, (entry) => Equal.equals(entry[1], key))
      if (Chunk.isNonEmpty(toRemove)) {
        const currentSize = tRef.unsafeGet(self.tSize, journal)
        tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), toRetain, journal)
        tRef.unsafeSet(self.tSize, currentSize - 1, journal)
      }
    }).traced(trace))

/** @internal */
export const removeAll = Debug.dualWithTrace<
  <K>(keys: Iterable<K>) => <V>(self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, keys: Iterable<K>) => STM.STM<never, never, void>
>(2, (trace) =>
  <K, V>(self: TMap.TMap<K, V>, keys: Iterable<K>) =>
    core.effect<never, void>((journal) => {
      const iterator = keys[Symbol.iterator]()
      let next: IteratorResult<K, any>
      while ((next = iterator.next()) && !next.done) {
        const buckets = tRef.unsafeGet(self.tBuckets, journal)
        const index = indexOf(next.value, buckets.chunk.length)
        const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
        const [toRemove, toRetain] = Chunk.partition(bucket, (entry) => Equal.equals(next.value)(entry[0]))
        if (Chunk.isNonEmpty(toRemove)) {
          const currentSize = tRef.unsafeGet(self.tSize, journal)
          tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), toRetain, journal)
          tRef.unsafeSet(self.tSize, currentSize - 1, journal)
        }
      }
    }).traced(trace))

/** @internal */
export const removeIf = Debug.dualWithTrace<
  <K, V>(
    predicate: (key: K, value: V) => boolean
  ) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Chunk.Chunk<readonly [K, V]>>,
  <K, V>(
    self: TMap.TMap<K, V>,
    predicate: (key: K, value: V) => boolean
  ) => STM.STM<never, never, Chunk.Chunk<readonly [K, V]>>
>(2, (trace, restore) =>
  <K, V>(
    self: TMap.TMap<K, V>,
    predicate: (key: K, value: V) => boolean
  ) =>
    core.effect<never, Chunk.Chunk<readonly [K, V]>>((journal) => {
      const buckets = tRef.unsafeGet(self.tBuckets, journal)
      const capacity = buckets.chunk.length
      const removed: Array<readonly [K, V]> = []
      let index = 0
      let newSize = 0
      while (index < capacity) {
        const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
        const iterator = bucket[Symbol.iterator]()
        let next: IteratorResult<readonly [K, V], any>
        let newBucket = Chunk.empty<readonly [K, V]>()
        while ((next = iterator.next()) && !next.done) {
          if (!restore(predicate)(next.value[0], next.value[1])) {
            newBucket = Chunk.prepend(newBucket, next.value)
            newSize = newSize + 1
          } else {
            removed.push(next.value)
          }
        }
        tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBucket, journal)
        index = index + 1
      }
      tRef.unsafeSet(self.tSize, newSize, journal)
      return Chunk.unsafeFromArray(removed)
    }).traced(trace))

/** @internal */
export const removeIfDiscard = Debug.dualWithTrace<
  <K, V>(predicate: (key: K, value: V) => boolean) => (self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, predicate: (key: K, value: V) => boolean) => STM.STM<never, never, void>
>(
  2,
  (trace, restore) =>
    <K, V>(self: TMap.TMap<K, V>, predicate: (key: K, value: V) => boolean) =>
      core.effect<never, void>((journal) => {
        const buckets = tRef.unsafeGet(self.tBuckets, journal)
        const capacity = buckets.chunk.length
        let index = 0
        let newSize = 0
        while (index < capacity) {
          const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
          const iterator = bucket[Symbol.iterator]()
          let next: IteratorResult<readonly [K, V], any>
          let newBucket = Chunk.empty<readonly [K, V]>()
          while ((next = iterator.next()) && !next.done) {
            if (!restore(predicate)(next.value[0], next.value[1])) {
              newBucket = Chunk.prepend(newBucket, next.value)
              newSize = newSize + 1
            }
          }
          tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBucket, journal)
          index = index + 1
        }
        tRef.unsafeSet(self.tSize, newSize, journal)
      }).traced(trace)
)

/** @internal */
export const retainIf = Debug.dualWithTrace<
  <K, V>(
    predicate: (key: K, value: V) => boolean
  ) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Chunk.Chunk<readonly [K, V]>>,
  <K, V>(
    self: TMap.TMap<K, V>,
    predicate: (key: K, value: V) => boolean
  ) => STM.STM<never, never, Chunk.Chunk<readonly [K, V]>>
>(
  2,
  (trace, restore) => (self, predicate) => removeIf(self, (key, value) => !restore(predicate)(key, value)).traced(trace)
)

/** @internal */
export const retainIfDiscard = Debug.dualWithTrace<
  <K, V>(predicate: (key: K, value: V) => boolean) => (self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, predicate: (key: K, value: V) => boolean) => STM.STM<never, never, void>
>(2, (trace, restore) =>
  (self, predicate) =>
    removeIfDiscard(
      self,
      (key, value) => !restore(predicate)(key, value)
    ).traced(trace))

/** @internal */
export const set = Debug.dualWithTrace<
  <K, V>(key: K, value: V) => (self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, key: K, value: V) => STM.STM<never, never, void>
>(3, (trace) =>
  <K, V>(self: TMap.TMap<K, V>, key: K, value: V) => {
    const resize = (journal: Journal.Journal, buckets: TArray.TArray<Chunk.Chunk<readonly [K, V]>>): void => {
      const capacity = buckets.chunk.length
      const newCapacity = capacity << 1
      const newBuckets = Array.from({ length: newCapacity }, () => Chunk.empty<readonly [K, V]>())
      let index = 0
      while (index < capacity) {
        const pairs = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
        const iterator = pairs[Symbol.iterator]()
        let next: IteratorResult<readonly [K, V], any>
        while ((next = iterator.next()) && !next.done) {
          const newIndex = indexOf(next.value[0], newCapacity)
          newBuckets[newIndex] = Chunk.prepend(newBuckets[newIndex], next.value)
        }
        index = index + 1
      }
      // insert new pair
      const newIndex = indexOf(key, newCapacity)
      newBuckets[newIndex] = Chunk.prepend(newBuckets[newIndex], [key, value] as const)

      const newArray: Array<TRef.TRef<Chunk.Chunk<readonly [K, V]>>> = []
      index = 0
      while (index < newCapacity) {
        newArray[index] = new tRef.TRefImpl(newBuckets[index])
        index = index + 1
      }
      const newTArray: TArray.TArray<Chunk.Chunk<readonly [K, V]>> = new tArray.TArrayImpl(
        Chunk.unsafeFromArray(newArray)
      )
      tRef.unsafeSet(self.tBuckets, newTArray, journal)
    }
    return core.effect<never, void>((journal) => {
      const buckets = tRef.unsafeGet(self.tBuckets, journal)
      const capacity = buckets.chunk.length
      const index = indexOf(key, capacity)
      const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
      const shouldUpdate = Chunk.some(bucket, (entry) => Equal.equals(key)(entry[0]))
      if (shouldUpdate) {
        const newBucket = Chunk.map(bucket, (entry) =>
          Equal.equals(key)(entry[0]) ?
            [key, value] as const :
            entry)
        tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBucket, journal)
      } else {
        const newSize = tRef.unsafeGet(self.tSize, journal) + 1
        tRef.unsafeSet(self.tSize, newSize, journal)
        if (capacity * LoadFactor < newSize) {
          resize(journal, buckets)
        } else {
          const newBucket = Chunk.prepend(bucket, [key, value] as const)
          tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBucket, journal)
        }
      }
    }).traced(trace)
  })

/** @internal */
export const setIfAbsent = Debug.dualWithTrace<
  <K, V>(key: K, value: V) => (self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, key: K, value: V) => STM.STM<never, never, void>
>(3, (trace) =>
  (self, key, value) =>
    core.flatMap(
      get(self, key),
      Option.match(
        () => set(self, key, value),
        stm.unit
      )
    ).traced(trace))

/** @internal */
export const size = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, number> => tRef.get(self.tSize).traced(trace)
)

/** @internal */
export const takeFirst = Debug.dualWithTrace<
  <K, V, A>(pf: (key: K, value: V) => Option.Option<A>) => (self: TMap.TMap<K, V>) => STM.STM<never, never, A>,
  <K, V, A>(self: TMap.TMap<K, V>, pf: (key: K, value: V) => Option.Option<A>) => STM.STM<never, never, A>
>(2, (trace, restore) =>
  <K, V, A>(self: TMap.TMap<K, V>, pf: (key: K, value: V) => Option.Option<A>) =>
    pipe(
      core.effect<never, Option.Option<A>>((journal) => {
        const buckets = tRef.unsafeGet(self.tBuckets, journal)
        const capacity = buckets.chunk.length
        const size = tRef.unsafeGet(self.tSize, journal)
        let result: Option.Option<A> = Option.none()
        let index = 0
        while (index < capacity && Option.isNone(result)) {
          const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
          const recreate = Chunk.some(bucket, (entry) => Option.isSome(pf(entry[0], entry[1])))
          if (recreate) {
            const iterator = bucket[Symbol.iterator]()
            let newBucket = Chunk.empty<readonly [K, V]>()
            let next: IteratorResult<readonly [K, V], any>
            while ((next = iterator.next()) && !next.done && Option.isNone(result)) {
              const option = restore(pf)(next.value[0], next.value[1])
              if (Option.isSome(option) && Option.isNone(result)) {
                result = option
              } else {
                newBucket = Chunk.prepend(newBucket, next.value)
              }
            }
            tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBucket, journal)
          }
          index = index + 1
        }
        if (Option.isSome(result)) {
          tRef.unsafeSet(self.tSize, size - 1, journal)
        }
        return result
      }),
      stm.collect((option) =>
        Option.isSome(option) ?
          Option.some(option.value) :
          Option.none()
      )
    ).traced(trace))

/** @internal */
export const takeFirstSTM = Debug.dualWithTrace<
  <K, V, R, E, A>(
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<R, E, A>,
  <K, V, R, E, A>(self: TMap.TMap<K, V>, pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>) => STM.STM<R, E, A>
>(2, (trace, restore) =>
  (self, pf) =>
    pipe(
      findSTM(self, (key, value) => core.map(restore(pf)(key, value), (a) => [key, a] as const)),
      stm.collect((option) => Option.isSome(option) ? Option.some(option.value) : Option.none()),
      core.flatMap((entry) => stm.as(remove(self, entry[0]), entry[1]))
    ).traced(trace))

/** @internal */
export const takeSome = Debug.dualWithTrace<
  <K, V, A>(
    pf: (key: K, value: V) => Option.Option<A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Chunk.NonEmptyChunk<A>>,
  <K, V, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => Option.Option<A>
  ) => STM.STM<never, never, Chunk.NonEmptyChunk<A>>
>(2, (trace, restore) =>
  <K, V, A>(self: TMap.TMap<K, V>, pf: (key: K, value: V) => Option.Option<A>) =>
    pipe(
      core.effect<never, Option.Option<Chunk.NonEmptyChunk<A>>>((journal) => {
        const buckets = tRef.unsafeGet(self.tBuckets, journal)
        const capacity = buckets.chunk.length
        const builder: Array<A> = []
        let newSize = 0
        let index = 0
        while (index < capacity) {
          const bucket = tRef.unsafeGet(Chunk.unsafeGet(buckets.chunk, index), journal)
          const recreate = Chunk.some(bucket, (entry) => Option.isSome(restore(pf)(entry[0], entry[1])))
          if (recreate) {
            const iterator = bucket[Symbol.iterator]()
            let newBucket = Chunk.empty<readonly [K, V]>()
            let next: IteratorResult<readonly [K, V], any>
            while ((next = iterator.next()) && !next.done) {
              const option = restore(pf)(next.value[0], next.value[1])
              if (Option.isSome(option)) {
                builder.push(option.value)
              } else {
                newBucket = Chunk.prepend(newBucket, next.value)
                newSize = newSize + 1
              }
            }
            tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBucket, journal)
          } else {
            newSize = newSize + bucket.length
          }
          index = index + 1
        }
        tRef.unsafeSet(self.tSize, newSize, journal)
        if (builder.length > 0) {
          return Option.some(Chunk.unsafeFromArray(builder) as Chunk.NonEmptyChunk<A>)
        }
        return Option.none()
      }),
      stm.collect((option) =>
        Option.isSome(option) ?
          Option.some(option.value) :
          Option.none()
      )
    ).traced(trace))

/** @internal */
export const takeSomeSTM = Debug.dualWithTrace<
  <K, V, R, E, A>(
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => (self: TMap.TMap<K, V>) => STM.STM<R, E, Chunk.NonEmptyChunk<A>>,
  <K, V, R, E, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) => STM.STM<R, E, Chunk.NonEmptyChunk<A>>
>(2, (trace, restore) =>
  <K, V, R, E, A>(
    self: TMap.TMap<K, V>,
    pf: (key: K, value: V) => STM.STM<R, Option.Option<E>, A>
  ) =>
    pipe(
      findAllSTM(
        self,
        (key, value) => core.map(restore(pf)(key, value), (a) => [key, a] as const)
      ),
      core.map((chunk) =>
        Chunk.isNonEmpty(chunk) ?
          Option.some(chunk) :
          Option.none()
      ),
      stm.collect((option) =>
        Option.isSome(option) ?
          Option.some(option.value) :
          Option.none()
      ),
      core.flatMap((entries) =>
        stm.as(
          removeAll(self, Chunk.map(entries, (entry) => entry[0])),
          Chunk.map(entries, (entry) => entry[1]) as Chunk.NonEmptyChunk<A>
        )
      )
    ).traced(trace))

/** @internal */
export const toChunk = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<readonly [K, V]>> =>
    core.effect<never, Chunk.Chunk<readonly [K, V]>>((journal) => {
      const buckets = tRef.unsafeGet(self.tBuckets, journal)
      const capacity = buckets.chunk.length
      const builder: Array<readonly [K, V]> = []
      let index = 0
      while (index < capacity) {
        const bucket = Chunk.unsafeGet(buckets.chunk, index)
        builder.push(...tRef.unsafeGet(bucket, journal))
        index = index + 1
      }
      return Chunk.unsafeFromArray(builder)
    }).traced(trace)
)

/** @internal */
export const toHashMap = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, HashMap.HashMap<K, V>> =>
    reduceWithIndex(
      self,
      HashMap.empty<K, V>(),
      (acc, value, key) => pipe(acc, HashMap.set(key, value))
    )
      .traced(trace)
)

/** @internal */
export const toReadonlyArray = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, ReadonlyArray<readonly [K, V]>> =>
    reduceWithIndex(
      self,
      [] as ReadonlyArray<readonly [K, V]>,
      (acc, value, key) => [[key, value] as const, ...acc]
    ).traced(trace)
)

/** @internal */
export const toReadonlyMap = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, ReadonlyMap<K, V>> =>
    reduceWithIndex(
      self,
      new Map<K, V>(),
      (acc, value, key) => acc.set(key, value)
    ).traced(trace)
)

/** @internal */
export const transform = Debug.dualWithTrace<
  <K, V>(f: (key: K, value: V) => readonly [K, V]) => (self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, f: (key: K, value: V) => readonly [K, V]) => STM.STM<never, never, void>
>(
  2,
  (trace, restore) =>
    <K, V>(self: TMap.TMap<K, V>, f: (key: K, value: V) => readonly [K, V]) =>
      core.effect<never, void>((journal) => {
        const buckets = pipe(self.tBuckets, tRef.unsafeGet(journal))
        const capacity = buckets.chunk.length
        const newBuckets = Array.from({ length: capacity }, () => Chunk.empty<readonly [K, V]>())
        let newSize = 0
        let index = 0
        while (index < capacity) {
          const bucket = Chunk.unsafeGet(buckets.chunk, index)
          const pairs = tRef.unsafeGet(bucket, journal)
          const iterator = pairs[Symbol.iterator]()
          let next: IteratorResult<readonly [K, V], any>
          while ((next = iterator.next()) && !next.done) {
            const newPair = restore(f)(next.value[0], next.value[1])
            const index = indexOf(newPair[0], capacity)
            const newBucket = newBuckets[index]
            if (!Chunk.some(newBucket, (entry) => Equal.equals(entry[0], newPair[0]))) {
              newBuckets[index] = Chunk.prepend(newBucket, newPair)
              newSize = newSize + 1
            }
          }
          index = index + 1
        }
        index = 0
        while (index < capacity) {
          tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBuckets[index], journal)
          index = index + 1
        }
        tRef.unsafeSet(self.tSize, newSize, journal)
      }).traced(trace)
)

/** @internal */
export const transformSTM = Debug.dualWithTrace<
  <K, V, R, E>(
    f: (key: K, value: V) => STM.STM<R, E, readonly [K, V]>
  ) => (self: TMap.TMap<K, V>) => STM.STM<R, E, void>,
  <K, V, R, E>(self: TMap.TMap<K, V>, f: (key: K, value: V) => STM.STM<R, E, readonly [K, V]>) => STM.STM<R, E, void>
>(
  2,
  (trace, restore) =>
    <K, V, R, E>(self: TMap.TMap<K, V>, f: (key: K, value: V) => STM.STM<R, E, readonly [K, V]>) =>
      pipe(
        core.flatMap(
          toChunk(self),
          stm.forEach((entry) => restore(f)(entry[0], entry[1]))
        ),
        core.flatMap((newData) =>
          core.effect<never, void>((journal) => {
            const buckets = tRef.unsafeGet(self.tBuckets, journal)
            const capacity = buckets.chunk.length
            const newBuckets = Array.from({ length: capacity }, () => Chunk.empty<readonly [K, V]>())
            const iterator = newData[Symbol.iterator]()
            let newSize = 0
            let next: IteratorResult<readonly [K, V], any>
            while ((next = iterator.next()) && !next.done) {
              const index = indexOf(next.value[0], capacity)
              const newBucket = newBuckets[index]
              if (!Chunk.some(newBucket, (entry) => Equal.equals(entry[0])(next.value[0]))) {
                newBuckets[index] = Chunk.prepend(newBucket, next.value)
                newSize = newSize + 1
              }
            }
            let index = 0
            while (index < capacity) {
              tRef.unsafeSet(Chunk.unsafeGet(buckets.chunk, index), newBuckets[index], journal)
              index = index + 1
            }
            tRef.unsafeSet(self.tSize, newSize, journal)
          })
        )
      ).traced(trace)
)

/** @internal */
export const transformValues = Debug.dualWithTrace<
  <V>(f: (value: V) => V) => <K>(self: TMap.TMap<K, V>) => STM.STM<never, never, void>,
  <K, V>(self: TMap.TMap<K, V>, f: (value: V) => V) => STM.STM<never, never, void>
>(2, (trace, restore) => (self, f) => transform(self, (key, value) => [key, restore(f)(value)]).traced(trace))

/** @internal */
export const transformValuesSTM = Debug.dualWithTrace<
  <V, R, E>(f: (value: V) => STM.STM<R, E, V>) => <K>(self: TMap.TMap<K, V>) => STM.STM<R, E, void>,
  <K, V, R, E>(self: TMap.TMap<K, V>, f: (value: V) => STM.STM<R, E, V>) => STM.STM<R, E, void>
>(2, (trace, restore) =>
  (self, f) =>
    transformSTM(
      self,
      (key, value) => core.map(restore(f)(value), (value) => [key, value])
    ).traced(trace))

/** @internal */
export const updateWith = Debug.dualWithTrace<
  <K, V>(
    key: K,
    f: (value: Option.Option<V>) => Option.Option<V>
  ) => (self: TMap.TMap<K, V>) => STM.STM<never, never, Option.Option<V>>,
  <K, V>(
    self: TMap.TMap<K, V>,
    key: K,
    f: (value: Option.Option<V>) => Option.Option<V>
  ) => STM.STM<never, never, Option.Option<V>>
>(3, (trace, restore) =>
  (self, key, f) =>
    core.flatMap(get(self, key), (option) =>
      pipe(
        restore(f)(option),
        Option.match(
          () => stm.as(remove(self, key), Option.none()),
          (value) => stm.as(set(self, key, value), Option.some(value))
        )
      )).traced(trace))

/** @internal */
export const values = Debug.methodWithTrace((trace) =>
  <K, V>(self: TMap.TMap<K, V>): STM.STM<never, never, Chunk.Chunk<V>> =>
    core.map(toChunk(self), Chunk.map((entry) => entry[1])).traced(trace)
)
