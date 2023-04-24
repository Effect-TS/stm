import * as Debug from "@effect/data/Debug"
import { pipe } from "@effect/data/Function"
import * as HashSet from "@effect/data/HashSet"
import type * as Option from "@effect/data/Option"
import type { Predicate } from "@effect/data/Predicate"
import * as RA from "@effect/data/ReadonlyArray"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as tMap from "@effect/stm/internal_effect_untraced/tMap"
import type * as STM from "@effect/stm/STM"
import type * as TMap from "@effect/stm/TMap"
import type * as TSet from "@effect/stm/TSet"

/** @internal */
const TSetSymbolKey = "@effect/stm/TSet"

/** @internal */
export const TSetTypeId: TSet.TSetTypeId = Symbol.for(
  TSetSymbolKey
) as TSet.TSetTypeId

/** @internal */
const tSetVariance = {
  _A: (_: never) => _
}

/** @internal */
class TSetImpl<A> implements TSet.TSet<A> {
  readonly [TSetTypeId] = tSetVariance
  constructor(readonly tMap: TMap.TMap<A, void>) {}
}

/** @internal */
export const add = Debug.dualWithTrace<
  <A>(value: A) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, value: A) => STM.STM<never, never, void>
>(2, (trace) => (self, value) => tMap.set(self.tMap, value, void 0 as void).traced(trace))

/** @internal */
export const difference = Debug.dualWithTrace<
  <A>(other: TSet.TSet<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, other: TSet.TSet<A>) => STM.STM<never, never, void>
>(2, (trace) =>
  (self, other) =>
    core.flatMap(
      toHashSet(other),
      (values) => removeIfDiscard(self, (value) => HashSet.has(values, value))
    ).traced(trace))

/** @internal */
export const empty = Debug.methodWithTrace((trace) =>
  <A>(): STM.STM<never, never, TSet.TSet<A>> => fromIterable([]).traced(trace)
)

/** @internal */
export const forEach = Debug.dualWithTrace<
  <A, R, E>(f: (value: A) => STM.STM<R, E, void>) => (self: TSet.TSet<A>) => STM.STM<R, E, void>,
  <A, R, E>(self: TSet.TSet<A>, f: (value: A) => STM.STM<R, E, void>) => STM.STM<R, E, void>
>(2, (trace, restore) => (self, f) => reduceSTM(self, void 0 as void, (_, value) => restore(f)(value)).traced(trace))

/** @internal */
export const fromIterable = Debug.methodWithTrace((trace) =>
  <A>(iterable: Iterable<A>): STM.STM<never, never, TSet.TSet<A>> =>
    core.map(
      tMap.fromIterable(Array.from(iterable).map((a) => [a, void 0])),
      (tMap) => new TSetImpl(tMap)
    ).traced(trace)
)

/** @internal */
export const has = Debug.dualWithTrace<
  <A>(value: A) => (self: TSet.TSet<A>) => STM.STM<never, never, boolean>,
  <A>(self: TSet.TSet<A>, value: A) => STM.STM<never, never, boolean>
>(2, (trace) => (self, value) => tMap.has(self.tMap, value).traced(trace))

/** @internal */
export const intersection = Debug.dualWithTrace<
  <A>(other: TSet.TSet<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, other: TSet.TSet<A>) => STM.STM<never, never, void>
>(2, (trace) =>
  (self, other) =>
    core.flatMap(
      toHashSet(other),
      (values) => pipe(self, retainIfDiscard((value) => pipe(values, HashSet.has(value))))
    ).traced(trace))

/** @internal */
export const isEmpty = Debug.methodWithTrace((trace) =>
  <A>(self: TSet.TSet<A>): STM.STM<never, never, boolean> => tMap.isEmpty(self.tMap).traced(trace)
)

/** @internal */
export const make = Debug.methodWithTrace((trace) =>
  <Elements extends Array<any>>(
    ...elements: Elements
  ): STM.STM<never, never, TSet.TSet<Elements[number]>> => fromIterable(elements).traced(trace)
)

/** @internal */
export const reduce = Debug.dualWithTrace<
  <Z, A>(zero: Z, f: (accumulator: Z, value: A) => Z) => (self: TSet.TSet<A>) => STM.STM<never, never, Z>,
  <Z, A>(self: TSet.TSet<A>, zero: Z, f: (accumulator: Z, value: A) => Z) => STM.STM<never, never, Z>
>(3, (trace, restore) =>
  (self, zero, f) =>
    tMap.reduceWithIndex(
      self.tMap,
      zero,
      (acc, _, key) => restore(f)(acc, key)
    ).traced(trace))

/** @internal */
export const reduceSTM = Debug.dualWithTrace<
  <Z, A, R, E>(zero: Z, f: (accumulator: Z, value: A) => STM.STM<R, E, Z>) => (self: TSet.TSet<A>) => STM.STM<R, E, Z>,
  <Z, A, R, E>(self: TSet.TSet<A>, zero: Z, f: (accumulator: Z, value: A) => STM.STM<R, E, Z>) => STM.STM<R, E, Z>
>(3, (trace, restore) =>
  (self, zero, f) =>
    tMap.reduceWithIndexSTM(
      self.tMap,
      zero,
      (acc, _, key) => restore(f)(acc, key)
    ).traced(trace))

/** @internal */
export const remove = Debug.dualWithTrace<
  <A>(value: A) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, value: A) => STM.STM<never, never, void>
>(2, (trace) => (self, value) => tMap.remove(self.tMap, value).traced(trace))

/** @internal */
export const removeAll = Debug.dualWithTrace<
  <A>(iterable: Iterable<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, iterable: Iterable<A>) => STM.STM<never, never, void>
>(2, (trace) => (self, iterable) => tMap.removeAll(self.tMap, iterable).traced(trace))

/** @internal */
export const removeIf = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, Array<A>>,
  <A>(self: TSet.TSet<A>, predicate: Predicate<A>) => STM.STM<never, never, Array<A>>
>(2, (trace, restore) =>
  (self, predicate) =>
    pipe(
      tMap.removeIf(self.tMap, (key) => restore(predicate)(key)),
      core.map(RA.map((entry) => entry[0]))
    ).traced(trace))

/** @internal */
export const removeIfDiscard = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, predicate: Predicate<A>) => STM.STM<never, never, void>
>(2, (trace, restore) =>
  (self, predicate) =>
    tMap.removeIfDiscard(
      self.tMap,
      (key) => restore(predicate)(key)
    ).traced(trace))

/** @internal */
export const retainIf = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, Array<A>>,
  <A>(self: TSet.TSet<A>, predicate: Predicate<A>) => STM.STM<never, never, Array<A>>
>(2, (trace, restore) =>
  (self, predicate) =>
    pipe(
      tMap.retainIf(self.tMap, (key) => restore(predicate)(key)),
      core.map(RA.map((entry) => entry[0]))
    ).traced(trace))

/** @internal */
export const retainIfDiscard = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, predicate: Predicate<A>) => STM.STM<never, never, void>
>(2, (trace, restore) =>
  (self, predicate) =>
    tMap.retainIfDiscard(
      self.tMap,
      (key) => restore(predicate)(key)
    ).traced(trace))

/** @internal */
export const size = Debug.methodWithTrace((trace) =>
  <A>(self: TSet.TSet<A>): STM.STM<never, never, number> =>
    core.map(toChunk(self), (chunk) => chunk.length).traced(trace)
)

/** @internal */
export const takeFirst = Debug.dualWithTrace<
  <A, B>(pf: (a: A) => Option.Option<B>) => (self: TSet.TSet<A>) => STM.STM<never, never, B>,
  <A, B>(self: TSet.TSet<A>, pf: (a: A) => Option.Option<B>) => STM.STM<never, never, B>
>(2, (trace, restore) => (self, pf) => tMap.takeFirst(self.tMap, (key) => restore(pf)(key)).traced(trace))

/** @internal */
export const takeFirstSTM = Debug.dualWithTrace<
  <A, R, E, B>(pf: (a: A) => STM.STM<R, Option.Option<E>, B>) => (self: TSet.TSet<A>) => STM.STM<R, E, B>,
  <A, R, E, B>(self: TSet.TSet<A>, pf: (a: A) => STM.STM<R, Option.Option<E>, B>) => STM.STM<R, E, B>
>(2, (trace, restore) => (self, pf) => tMap.takeFirstSTM(self.tMap, (key) => restore(pf)(key)).traced(trace))

/** @internal */
export const takeSome = Debug.dualWithTrace<
  <A, B>(pf: (a: A) => Option.Option<B>) => (self: TSet.TSet<A>) => STM.STM<never, never, RA.NonEmptyArray<B>>,
  <A, B>(self: TSet.TSet<A>, pf: (a: A) => Option.Option<B>) => STM.STM<never, never, RA.NonEmptyArray<B>>
>(2, (trace, restore) => (self, pf) => tMap.takeSome(self.tMap, (key) => restore(pf)(key)).traced(trace))

/** @internal */
export const takeSomeSTM = Debug.dualWithTrace<
  <A, R, E, B>(
    pf: (a: A) => STM.STM<R, Option.Option<E>, B>
  ) => (self: TSet.TSet<A>) => STM.STM<R, E, RA.NonEmptyArray<B>>,
  <A, R, E, B>(
    self: TSet.TSet<A>,
    pf: (a: A) => STM.STM<R, Option.Option<E>, B>
  ) => STM.STM<R, E, RA.NonEmptyArray<B>>
>(2, (trace, restore) => (self, pf) => tMap.takeSomeSTM(self.tMap, (key) => restore(pf)(key)).traced(trace))

/** @internal */
export const toChunk = Debug.methodWithTrace((trace) =>
  <A>(self: TSet.TSet<A>): STM.STM<never, never, Array<A>> => tMap.keys(self.tMap).traced(trace)
)

/** @internal */
export const toHashSet = Debug.methodWithTrace((trace) =>
  <A>(self: TSet.TSet<A>): STM.STM<never, never, HashSet.HashSet<A>> =>
    reduce(
      self,
      HashSet.empty<A>(),
      (acc, value) => pipe(acc, HashSet.add(value))
    ).traced(trace)
)

/** @internal */
export const toReadonlyArray = Debug.methodWithTrace((trace) =>
  <A>(self: TSet.TSet<A>): STM.STM<never, never, ReadonlyArray<A>> =>
    reduce<ReadonlyArray<A>, A>(
      self,
      [],
      (acc, value) => [...acc, value]
    ).traced(trace)
)

/** @internal */
export const toReadonlySet = Debug.methodWithTrace((trace) =>
  <A>(self: TSet.TSet<A>): STM.STM<never, never, ReadonlySet<A>> =>
    core.map(toReadonlyArray(self), (values) => new Set(values)).traced(trace)
)

/** @internal */
export const transform = Debug.dualWithTrace<
  <A>(f: (a: A) => A) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, f: (a: A) => A) => STM.STM<never, never, void>
>(2, (trace, restore) => (self, f) => tMap.transform(self.tMap, (key, value) => [restore(f)(key), value]).traced(trace))

/** @internal */
export const transformSTM = Debug.dualWithTrace<
  <A, R, E>(f: (a: A) => STM.STM<R, E, A>) => (self: TSet.TSet<A>) => STM.STM<R, E, void>,
  <A, R, E>(self: TSet.TSet<A>, f: (a: A) => STM.STM<R, E, A>) => STM.STM<R, E, void>
>(2, (trace, restore) =>
  (self, f) =>
    tMap.transformSTM(
      self.tMap,
      (key, value) => core.map(restore(f)(key), (a) => [a, value])
    ).traced(trace))

/** @internal */
export const union = Debug.dualWithTrace<
  <A>(other: TSet.TSet<A>) => (self: TSet.TSet<A>) => STM.STM<never, never, void>,
  <A>(self: TSet.TSet<A>, other: TSet.TSet<A>) => STM.STM<never, never, void>
>(2, (trace) => (self, other) => forEach(other, (value) => add(self, value)).traced(trace))
