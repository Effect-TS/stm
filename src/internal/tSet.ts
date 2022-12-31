import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as tMap from "@effect/stm/internal/tMap"
import type * as STM from "@effect/stm/STM"
import type * as TMap from "@effect/stm/TMap"
import type * as TSet from "@effect/stm/TSet"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as HashSet from "@fp-ts/data/HashSet"
import type * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

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

/**
 * @macro traced
 * @internal
 */
export const add = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(self.tMap, tMap.set(value, void 0 as void)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const difference = <A>(other: TSet.TSet<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(
      toHashSet(other),
      core.flatMap((values) => pipe(self, removeIfDiscard((value) => pipe(values, HashSet.has(value)))))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const empty = <A>(): STM.STM<never, never, TSet.TSet<A>> => {
  const trace = getCallTrace()
  return fromIterable([]).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const forEach = <A, R, E>(f: (value: A) => STM.STM<R, E, void>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<R, E, void> =>
    pipe(self, reduceSTM(void 0 as void, (_, value) => f(value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fromIterable = <A>(iterable: Iterable<A>): STM.STM<never, never, TSet.TSet<A>> => {
  const trace = getCallTrace()
  return pipe(
    tMap.fromIterable(Array.from(iterable).map((a) => [a, undefined])),
    core.map((tMap) => new TSetImpl(tMap))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const has = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, boolean> => pipe(self.tMap, tMap.has(value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const intersection = <A>(other: TSet.TSet<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(
      toHashSet(other),
      core.flatMap((values) => pipe(self, retainIfDiscard((value) => pipe(values, HashSet.has(value)))))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isEmpty = <A>(self: TSet.TSet<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return tMap.isEmpty(self.tMap).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const make = <Elements extends Array<any>>(
  ...elements: Elements
): STM.STM<never, never, TSet.TSet<Elements[number]>> => {
  const trace = getCallTrace()
  return fromIterable(elements).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduce = <Z, A>(zero: Z, f: (accumulator: Z, value: A) => Z) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, Z> =>
    pipe(self.tMap, tMap.reduceWithIndex(zero, (acc, _, key) => f(acc, key))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceSTM = <Z, A, R, E>(zero: Z, f: (accumulator: Z, value: A) => STM.STM<R, E, Z>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<R, E, Z> =>
    pipe(self.tMap, tMap.reduceWithIndexSTM(zero, (acc, _, key) => f(acc, key))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const remove = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> => pipe(self.tMap, tMap.remove(value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const removeAll = <A>(iterable: Iterable<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> => pipe(self.tMap, tMap.removeAll(iterable)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const removeIf = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, Chunk.Chunk<A>> =>
    pipe(
      self.tMap,
      tMap.removeIf((key) => predicate(key)),
      core.map(Chunk.map((entry) => entry[0]))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const removeIfDiscard = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(
      self.tMap,
      tMap.removeIfDiscard((key) => predicate(key))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retainIf = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, Chunk.Chunk<A>> =>
    pipe(
      self.tMap,
      tMap.retainIf((key) => predicate(key)),
      core.map(Chunk.map((entry) => entry[0]))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retainIfDiscard = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(
      self.tMap,
      tMap.retainIfDiscard((key) => predicate(key))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const size = <A>(self: TSet.TSet<A>): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return pipe(toChunk(self), core.map((chunk) => chunk.length)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeFirst = <A, B>(pf: (a: A) => Option.Option<B>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, B> =>
    pipe(self.tMap, tMap.takeFirst((key) => pf(key))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeFirstSTM = <A, R, E, B>(pf: (a: A) => STM.STM<R, Option.Option<E>, B>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<R, E, B> => pipe(self.tMap, tMap.takeFirstSTM((key) => pf(key))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeSome = <A, B>(pf: (a: A) => Option.Option<B>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, Chunk.NonEmptyChunk<B>> =>
    pipe(self.tMap, tMap.takeSome((key) => pf(key))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeSomeSTM = <A, R, E, B>(pf: (a: A) => STM.STM<R, Option.Option<E>, B>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<R, E, Chunk.NonEmptyChunk<B>> =>
    pipe(self.tMap, tMap.takeSomeSTM((key) => pf(key))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toChunk = <A>(self: TSet.TSet<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return tMap.keys(self.tMap).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toHashSet = <A>(self: TSet.TSet<A>): STM.STM<never, never, HashSet.HashSet<A>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    reduce(HashSet.empty<A>(), (acc, value) => pipe(acc, HashSet.add(value)))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toReadonlyArray = <A>(self: TSet.TSet<A>): STM.STM<never, never, ReadonlyArray<A>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    reduce<ReadonlyArray<A>, A>([], (acc, value) => [...acc, value])
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toReadonlySet = <A>(self: TSet.TSet<A>): STM.STM<never, never, ReadonlySet<A>> => {
  const trace = getCallTrace()
  return pipe(toReadonlyArray(self), core.map((values) => new Set(values))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transform = <A>(f: (a: A) => A) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(self.tMap, tMap.transform((key, value) => [f(key), value])).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transformSTM = <A, R, E>(f: (a: A) => STM.STM<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<R, E, void> =>
    pipe(self.tMap, tMap.transformSTM((key, value) => pipe(f(key), core.map((a) => [a, value])))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const union = <A>(other: TSet.TSet<A>) => {
  const trace = getCallTrace()
  return (self: TSet.TSet<A>): STM.STM<never, never, void> =>
    pipe(other, forEach((value) => pipe(self, add(value)))).traced(trace)
}
