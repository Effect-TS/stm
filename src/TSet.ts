/**
 * @since 1.0.0
 */
import type * as HashSet from "@effect/data/HashSet"
import type * as Option from "@effect/data/Option"
import type { Predicate } from "@effect/data/Predicate"
import * as internal from "@effect/stm/internal/tSet"
import type * as STM from "@effect/stm/STM"
import type * as TMap from "@effect/stm/TMap"

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
 * @since 1.0.0
 * @category mutations
 */
export const add: {
  <A>(value: A): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, value: A): STM.STM<never, never, void>
} = internal.add

/**
 * Atomically transforms the set into the difference of itself and the
 * provided set.
 *
 * @since 1.0.0
 * @category mutations
 */
export const difference: {
  <A>(other: TSet<A>): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, other: TSet<A>): STM.STM<never, never, void>
} = internal.difference

/**
 * Makes an empty `TSet`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const empty: <A>() => STM.STM<never, never, TSet<A>> = internal.empty

/**
 * Atomically performs transactional-effect for each element in set.
 *
 * @since 1.0.0
 * @category elements
 */
export const forEach: {
  <A, R, E>(f: (value: A) => STM.STM<R, E, void>): (self: TSet<A>) => STM.STM<R, E, void>
  <A, R, E>(self: TSet<A>, f: (value: A) => STM.STM<R, E, void>): STM.STM<R, E, void>
} = internal.forEach

/**
 * Makes a new `TSet` initialized with provided iterable.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromIterable: <A>(iterable: Iterable<A>) => STM.STM<never, never, TSet<A>> = internal.fromIterable

/**
 * Tests whether or not set contains an element.
 *
 * @since 1.0.0
 * @category elements
 */
export const has: {
  <A>(value: A): (self: TSet<A>) => STM.STM<never, never, boolean>
  <A>(self: TSet<A>, value: A): STM.STM<never, never, boolean>
} = internal.has

/**
 * Atomically transforms the set into the intersection of itself and the
 * provided set.
 *
 * @since 1.0.0
 * @category mutations
 */
export const intersection: {
  <A>(other: TSet<A>): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, other: TSet<A>): STM.STM<never, never, void>
} = internal.intersection

/**
 * Tests if the set is empty or not
 *
 * @since 1.0.0
 * @category getters
 */
export const isEmpty: <A>(self: TSet<A>) => STM.STM<never, never, boolean> = internal.isEmpty

/**
 * Makes a new `TSet` that is initialized with specified values.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make: <Elements extends Array<any>>(
  ...elements: Elements
) => STM.STM<never, never, TSet<Elements[number]>> = internal.make

/**
 * Atomically folds using a pure function.
 *
 * @since 1.0.0
 * @category folding
 */
export const reduce: {
  <Z, A>(zero: Z, f: (accumulator: Z, value: A) => Z): (self: TSet<A>) => STM.STM<never, never, Z>
  <Z, A>(self: TSet<A>, zero: Z, f: (accumulator: Z, value: A) => Z): STM.STM<never, never, Z>
} = internal.reduce

/**
 * Atomically folds using a transactional function.
 *
 * @since 1.0.0
 * @category folding
 */
export const reduceSTM: {
  <Z, A, R, E>(zero: Z, f: (accumulator: Z, value: A) => STM.STM<R, E, Z>): (self: TSet<A>) => STM.STM<R, E, Z>
  <Z, A, R, E>(self: TSet<A>, zero: Z, f: (accumulator: Z, value: A) => STM.STM<R, E, Z>): STM.STM<R, E, Z>
} = internal.reduceSTM

/**
 * Removes a single element from the set.
 *
 * @since 1.0.0
 * @category mutations
 */
export const remove: {
  <A>(value: A): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, value: A): STM.STM<never, never, void>
} = internal.remove

/**
 * Removes elements from the set.
 *
 * @since 1.0.0
 * @category mutations
 */
export const removeAll: {
  <A>(iterable: Iterable<A>): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, iterable: Iterable<A>): STM.STM<never, never, void>
} = internal.removeAll

/**
 * Removes bindings matching predicate and returns the removed entries.
 *
 * @since 1.0.0
 * @category mutations
 */
export const removeIf: {
  <A>(predicate: Predicate<A>): (self: TSet<A>) => STM.STM<never, never, Array<A>>
  <A>(self: TSet<A>, predicate: Predicate<A>): STM.STM<never, never, Array<A>>
} = internal.removeIf

/**
 * Removes elements matching predicate.
 *
 * @since 1.0.0
 * @category mutations
 */
export const removeIfDiscard: {
  <A>(predicate: Predicate<A>): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, predicate: Predicate<A>): STM.STM<never, never, void>
} = internal.removeIfDiscard

/**
 * Retains bindings matching predicate and returns removed bindings.
 *
 * @since 1.0.0
 * @category mutations
 */
export const retainIf: {
  <A>(predicate: Predicate<A>): (self: TSet<A>) => STM.STM<never, never, Array<A>>
  <A>(self: TSet<A>, predicate: Predicate<A>): STM.STM<never, never, Array<A>>
} = internal.retainIf

/**
 * Retains elements matching predicate.
 *
 * @since 1.0.0
 * @category mutations
 */
export const retainIfDiscard: {
  <A>(predicate: Predicate<A>): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, predicate: Predicate<A>): STM.STM<never, never, void>
} = internal.retainIfDiscard

/**
 * Returns the set's cardinality.
 *
 * @since 1.0.0
 * @category getters
 */
export const size: <A>(self: TSet<A>) => STM.STM<never, never, number> = internal.size

/**
 * Takes the first matching value, or retries until there is one.
 *
 * @since 1.0.0
 * @category mutations
 */
export const takeFirst: {
  <A, B>(pf: (a: A) => Option.Option<B>): (self: TSet<A>) => STM.STM<never, never, B>
  <A, B>(self: TSet<A>, pf: (a: A) => Option.Option<B>): STM.STM<never, never, B>
} = internal.takeFirst

/**
 * Takes the first matching value, or retries until there is one.
 *
 * @since 1.0.0
 * @category mutations
 */
export const takeFirstSTM: {
  <A, R, E, B>(pf: (a: A) => STM.STM<R, Option.Option<E>, B>): (self: TSet<A>) => STM.STM<R, E, B>
  <A, R, E, B>(self: TSet<A>, pf: (a: A) => STM.STM<R, Option.Option<E>, B>): STM.STM<R, E, B>
} = internal.takeFirstSTM

/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @since 1.0.0
 * @category mutations
 */
export const takeSome: {
  <A, B>(pf: (a: A) => Option.Option<B>): (self: TSet<A>) => STM.STM<never, never, [B, ...Array<B>]>
  <A, B>(self: TSet<A>, pf: (a: A) => Option.Option<B>): STM.STM<never, never, [B, ...Array<B>]>
} = internal.takeSome

/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @since 1.0.0
 * @category mutations
 */
export const takeSomeSTM: {
  <A, R, E, B>(pf: (a: A) => STM.STM<R, Option.Option<E>, B>): (self: TSet<A>) => STM.STM<R, E, [B, ...Array<B>]>
  <A, R, E, B>(self: TSet<A>, pf: (a: A) => STM.STM<R, Option.Option<E>, B>): STM.STM<R, E, [B, ...Array<B>]>
} = internal.takeSomeSTM

/**
 * Collects all elements into a `Chunk`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toChunk: <A>(self: TSet<A>) => STM.STM<never, never, Array<A>> = internal.toChunk

/**
 * Collects all elements into a `HashSet`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toHashSet: <A>(self: TSet<A>) => STM.STM<never, never, HashSet.HashSet<A>> = internal.toHashSet

/**
 * Collects all elements into a `ReadonlyArray`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toReadonlyArray: <A>(self: TSet<A>) => STM.STM<never, never, ReadonlyArray<A>> = internal.toReadonlyArray

/**
 * Collects all elements into a `ReadonlySet`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toReadonlySet: <A>(self: TSet<A>) => STM.STM<never, never, ReadonlySet<A>> = internal.toReadonlySet

/**
 * Atomically updates all elements using a pure function.
 *
 * @since 1.0.0
 * @category mutations
 */
export const transform: {
  <A>(f: (a: A) => A): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, f: (a: A) => A): STM.STM<never, never, void>
} = internal.transform

/**
 * Atomically updates all elements using a transactional function.
 *
 * @since 1.0.0
 * @category mutations
 */
export const transformSTM: {
  <A, R, E>(f: (a: A) => STM.STM<R, E, A>): (self: TSet<A>) => STM.STM<R, E, void>
  <A, R, E>(self: TSet<A>, f: (a: A) => STM.STM<R, E, A>): STM.STM<R, E, void>
} = internal.transformSTM

/**
 * Atomically transforms the set into the union of itself and the provided
 * set.
 *
 * @since 1.0.0
 * @category mutations
 */
export const union: {
  <A>(other: TSet<A>): (self: TSet<A>) => STM.STM<never, never, void>
  <A>(self: TSet<A>, other: TSet<A>): STM.STM<never, never, void>
} = internal.union
