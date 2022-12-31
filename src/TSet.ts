/**
 * @since 1.0.0
 */
import * as internal from "@effect/stm/internal/tSet"
import type * as STM from "@effect/stm/STM"
import type * as TMap from "@effect/stm/TMap"
import type * as Chunk from "@fp-ts/data/Chunk"
import type * as HashSet from "@fp-ts/data/HashSet"
import type * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TSetTypeId: unique symbol = internal.TSetTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type TSetTypeId = typeof TSetTypeId

/**
 * Transactional set implemented on top of `TMap`.
 *
 * @since 1.0.0
 * @category models
 */
export interface TSet<A> extends TSet.Variance<A> {}
/**
 * @internal
 * @since 1.0.0
 */
export interface TSet<A> {
  /** @internal */
  readonly tMap: TMap.TMap<A, void>
}

/**
 * @since 1.0.0
 */
export declare namespace TSet {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<A> {
    readonly [TSetTypeId]: {
      readonly _A: (_: never) => A
    }
  }
}

/**
 * Stores new element in the set.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const add: <A>(value: A) => (self: TSet<A>) => STM.STM<never, never, void> = internal.add

/**
 * Atomically transforms the set into the difference of itself and the
 * provided set.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const difference: <A>(other: TSet<A>) => (self: TSet<A>) => STM.STM<never, never, void> = internal.difference

/**
 * Makes an empty `TSet`.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const empty: <A>() => STM.STM<never, never, TSet<A>> = internal.empty

/**
 * Atomically performs transactional-effect for each element in set.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const forEach: <A, R, E>(f: (value: A) => STM.STM<R, E, void>) => (self: TSet<A>) => STM.STM<R, E, void> =
  internal.forEach

/**
 * Makes a new `TSet` initialized with provided iterable.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const fromIterable: <A>(iterable: Iterable<A>) => STM.STM<never, never, TSet<A>> = internal.fromIterable

/**
 * Tests whether or not set contains an element.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const has: <A>(value: A) => (self: TSet<A>) => STM.STM<never, never, boolean> = internal.has

/**
 * Atomically transforms the set into the intersection of itself and the
 * provided set.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const intersection: <A>(other: TSet<A>) => (self: TSet<A>) => STM.STM<never, never, void> = internal.intersection

/**
 * Tests if the set is empty or not
 *
 * @macro traced
 * @since 1.0.0
 * @category getters
 */
export const isEmpty: <A>(self: TSet<A>) => STM.STM<never, never, boolean> = internal.isEmpty

/**
 * Makes a new `TSet` that is initialized with specified values.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const make: <Elements extends Array<any>>(
  ...elements: Elements
) => STM.STM<never, never, TSet<Elements[number]>> = internal.make

/**
 * Atomically folds using a pure function.
 *
 * @macro traced
 * @since 1.0.0
 * @category folding
 */
export const reduce: <Z, A>(
  zero: Z,
  f: (accumulator: Z, value: A) => Z
) => (self: TSet<A>) => STM.STM<never, never, Z> = internal.reduce

/**
 * Atomically folds using a transactional function.
 *
 * @macro traced
 * @since 1.0.0
 * @category folding
 */
export const reduceSTM: <Z, A, R, E>(
  zero: Z,
  f: (accumulator: Z, value: A) => STM.STM<R, E, Z>
) => (self: TSet<A>) => STM.STM<R, E, Z> = internal.reduceSTM

/**
 * Removes a single element from the set.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const remove: <A>(value: A) => (self: TSet<A>) => STM.STM<never, never, void> = internal.remove

/**
 * Removes elements from the set.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const removeAll: <A>(iterable: Iterable<A>) => (self: TSet<A>) => STM.STM<never, never, void> =
  internal.removeAll

/**
 * Removes bindings matching predicate and returns the removed entries.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const removeIf: <A>(predicate: Predicate<A>) => (self: TSet<A>) => STM.STM<never, never, Chunk.Chunk<A>> =
  internal.removeIf

/**
 * Removes elements matching predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const removeIfDiscard: <A>(predicate: Predicate<A>) => (self: TSet<A>) => STM.STM<never, never, void> =
  internal.removeIfDiscard

/**
 * Retains bindings matching predicate and returns removed bindings.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const retainIf: <A>(predicate: Predicate<A>) => (self: TSet<A>) => STM.STM<never, never, Chunk.Chunk<A>> =
  internal.retainIf

/**
 * Retains elements matching predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const retainIfDiscard: <A>(predicate: Predicate<A>) => (self: TSet<A>) => STM.STM<never, never, void> =
  internal.retainIfDiscard

/**
 * Returns the set's cardinality.
 *
 * @macro traced
 * @since 1.0.0
 * @category getters
 */
export const size: <A>(self: TSet<A>) => STM.STM<never, never, number> = internal.size

/**
 * Takes the first matching value, or retries until there is one.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const takeFirst: <A, B>(pf: (a: A) => Option.Option<B>) => (self: TSet<A>) => STM.STM<never, never, B> =
  internal.takeFirst

/**
 * Takes the first matching value, or retries until there is one.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const takeFirstSTM: <A, R, E, B>(
  pf: (a: A) => STM.STM<R, Option.Option<E>, B>
) => (self: TSet<A>) => STM.STM<R, E, B> = internal.takeFirstSTM

/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const takeSome: <A, B>(
  pf: (a: A) => Option.Option<B>
) => (self: TSet<A>) => STM.STM<never, never, Chunk.NonEmptyChunk<B>> = internal.takeSome

/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const takeSomeSTM: <A, R, E, B>(
  pf: (a: A) => STM.STM<R, Option.Option<E>, B>
) => (self: TSet<A>) => STM.STM<R, E, Chunk.NonEmptyChunk<B>> = internal.takeSomeSTM

/**
 * Collects all elements into a `Chunk`.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const toChunk: <A>(self: TSet<A>) => STM.STM<never, never, Chunk.Chunk<A>> = internal.toChunk

/**
 * Collects all elements into a `HashSet`.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const toHashSet: <A>(self: TSet<A>) => STM.STM<never, never, HashSet.HashSet<A>> = internal.toHashSet

/**
 * Collects all elements into a `ReadonlyArray`.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const toReadonlyArray: <A>(self: TSet<A>) => STM.STM<never, never, ReadonlyArray<A>> = internal.toReadonlyArray

/**
 * Collects all elements into a `ReadonlySet`.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const toReadonlySet: <A>(self: TSet<A>) => STM.STM<never, never, ReadonlySet<A>> = internal.toReadonlySet

/**
 * Atomically updates all elements using a pure function.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const transform: <A>(f: (a: A) => A) => (self: TSet<A>) => STM.STM<never, never, void> = internal.transform

/**
 * Atomically updates all elements using a transactional function.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const transformSTM: <A, R, E>(f: (a: A) => STM.STM<R, E, A>) => (self: TSet<A>) => STM.STM<R, E, void> =
  internal.transformSTM

/**
 * Atomically transforms the set into the union of itself and the provided
 * set.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const union: <A>(other: TSet<A>) => (self: TSet<A>) => STM.STM<never, never, void> = internal.union
