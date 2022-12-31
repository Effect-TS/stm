/**
 * @since 1.0.0
 */
import * as internal from "@effect/stm/internal/tArray"
import type * as STM from "@effect/stm/STM"
import type * as TRef from "@effect/stm/TRef"
import type * as Order from "@fp-ts/core/typeclass/Order"
import type * as Chunk from "@fp-ts/data/Chunk"
import type * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TArrayTypeId: unique symbol = internal.TArrayTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type TArrayTypeId = typeof TArrayTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface TArray<A> extends TArray.Variance<A> {}
/**
 * @internal
 * @since 1.0.0
 */
export interface TArray<A> {
  /** @internal */
  readonly chunk: Chunk.Chunk<TRef.TRef<A>>
}

/**
 * @since 1.0.0
 */
export declare namespace TArray {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<A> {
    readonly [TArrayTypeId]: {
      readonly _A: (_: never) => A
    }
  }
}

/**
 * Finds the result of applying a partial function to the first value in its
 * domain.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const collectFirst: <A, B>(
  pf: (a: A) => Option.Option<B>
) => (self: TArray<A>) => STM.STM<never, never, Option.Option<B>> = internal.collectFirst

/**
 * Finds the result of applying an transactional partial function to the first
 * value in its domain.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const collectFirstSTM: <A, R, E, B>(
  pf: (a: A) => Option.Option<STM.STM<R, E, B>>
) => (self: TArray<A>) => STM.STM<R, E, Option.Option<B>> = internal.collectFirstSTM

/**
 * Determine if the array contains a specified value.
 *
 * @macro trace
 * @since 1.0.0
 * @category elements
 */
export const contains: <A>(value: A) => (self: TArray<A>) => STM.STM<never, never, boolean> = internal.contains

/**
 * Count the values in the array matching a predicate.
 *
 * @macro trace
 * @since 1.0.0
 * @category folding
 */
export const count: <A>(predicate: Predicate<A>) => (self: TArray<A>) => STM.STM<never, never, number> = internal.count

/**
 * Count the values in the array matching a transactional predicate.
 *
 * @macro trace
 * @since 1.0.0
 * @category folding
 */
export const countSTM: <A, R, E>(
  predicate: (value: A) => STM.STM<R, E, boolean>
) => (self: TArray<A>) => STM.STM<R, E, number> = internal.countSTM

/**
 * Makes an empty `TArray`.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const empty: <A>() => STM.STM<never, never, TArray<A>> = internal.empty

/**
 * Atomically evaluate the conjunction of a predicate across the members of
 * the array.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const every: <A>(predicate: Predicate<A>) => (self: TArray<A>) => STM.STM<never, never, boolean> = internal.every

/**
 * Atomically evaluate the conjunction of a transactional predicate across the
 * members of the array.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const everySTM: <A, R, E>(
  predicate: (value: A) => STM.STM<R, E, boolean>
) => (self: TArray<A>) => STM.STM<R, E, boolean> = internal.everySTM

/**
 * Find the first element in the array matching the specified predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findFirst: <A>(predicate: Predicate<A>) => (self: TArray<A>) => STM.STM<never, never, Option.Option<A>> =
  internal.findFirst

/**
 * Get the first index of a specific value in the array, optionally starting
 * from the specified index.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findFirstIndex: <A>(
  value: A,
  from?: number
) => (self: TArray<A>) => STM.STM<never, never, Option.Option<number>> = internal.findFirstIndex

/**
 * Get the index of the first entry in the array, optionally starting from the
 * specified index, matching a predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findFirstIndexWhere: <A>(
  predicate: Predicate<A>,
  from?: number
) => (self: TArray<A>) => STM.STM<never, never, Option.Option<number>> = internal.findFirstIndexWhere

/**
 * Starting at specified index, get the index of the next entry that matches a
 * transactional predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findFirstIndexWhereSTM: <A, R, E>(
  predicate: (value: A) => STM.STM<R, E, boolean>,
  from?: number
) => (self: TArray<A>) => STM.STM<R, E, Option.Option<number>> = internal.findFirstIndexWhereSTM

/**
 * Find the first element in the array matching a transactional predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findFirstSTM: <A, R, E>(
  predicate: (value: A) => STM.STM<R, E, boolean>
) => (self: TArray<A>) => STM.STM<R, E, Option.Option<A>> = internal.findFirstSTM

/**
 * Find the last element in the array matching a predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findLast: <A>(predicate: Predicate<A>) => (self: TArray<A>) => STM.STM<never, never, Option.Option<A>> =
  internal.findLast

/**
 * Get the first index of a specific value in the array, bounded above by a
 * specific index.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findLastIndex: <A>(
  value: A,
  end?: number | undefined
) => (self: TArray<A>) => STM.STM<never, never, Option.Option<number>> = internal.findLastIndex

/**
 * Find the last element in the array matching a transactional predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const findLastSTM: <A, R, E>(
  predicate: (value: A) => STM.STM<R, E, boolean>
) => (self: TArray<A>) => STM.STM<R, E, Option.Option<A>> = internal.findLastSTM

/**
 * Atomically performs transactional effect for each item in array.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const forEach: <A, R, E>(f: (value: A) => STM.STM<R, E, void>) => (self: TArray<A>) => STM.STM<R, E, void> =
  internal.forEach

/**
 * Makes a new `TArray` initialized with provided iterable.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const fromIterable: <A>(iterable: Iterable<A>) => STM.STM<never, never, TArray<A>> = internal.fromIterable

/**
 * Extracts value from ref in array.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const get: (index: number) => <A>(self: TArray<A>) => STM.STM<never, never, A> = internal.get

/**
 * The first entry of the array, if it exists.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const headOption: <A>(self: TArray<A>) => STM.STM<never, never, Option.Option<A>> = internal.headOption

/**
 * The last entry in the array, if it exists.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const lastOption: <A>(self: TArray<A>) => STM.STM<never, never, Option.Option<A>> = internal.lastOption

/**
 * Makes a new `TArray` that is initialized with specified values.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const make: <Elements extends [any, ...Array<any>]>(
  ...elements: Elements
) => STM.STM<never, never, TArray<Elements[number]>> = internal.make

/**
 * Atomically compute the greatest element in the array, if it exists.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const maxOption: <A>(order: Order.Order<A>) => (self: TArray<A>) => STM.STM<never, never, Option.Option<A>> =
  internal.maxOption

/**
 * Atomically compute the least element in the array, if it exists.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const minOption: <A>(order: Order.Order<A>) => (self: TArray<A>) => STM.STM<never, never, Option.Option<A>> =
  internal.minOption

/**
 * Atomically folds using a pure function.
 *
 * @macro traced
 * @since 1.0.0
 * @category folding
 */
export const reduce: <Z, A>(
  zero: Z,
  f: (accumulator: Z, current: A) => Z
) => (self: TArray<A>) => STM.STM<never, never, Z> = internal.reduce

/**
 * Atomically reduce the array, if non-empty, by a binary operator.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const reduceOption: <A>(f: (x: A, y: A) => A) => (self: TArray<A>) => STM.STM<never, never, Option.Option<A>> =
  internal.reduceOption

/**
 * Atomically reduce the non-empty array using a transactional binary
 * operator.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const reduceOptionSTM: <A, R, E>(
  f: (x: A, y: A) => STM.STM<R, E, A>
) => (self: TArray<A>) => STM.STM<R, E, Option.Option<A>> = internal.reduceOptionSTM

/**
 * Atomically folds using a transactional function.
 *
 * @macro trace
 * @since 1.0.0
 * @category folding
 */
export const reduceSTM: <Z, A, R, E>(
  zero: Z,
  f: (accumulator: Z, current: A) => STM.STM<R, E, Z>
) => (self: TArray<A>) => STM.STM<R, E, Z> = internal.reduceSTM

/**
 * Returns the size of the `TArray`.
 *
 * @since 1.0.0
 * @category getters
 */
export const size: <A>(self: TArray<A>) => number = internal.size

/**
 * Determine if the array contains a value satisfying a predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const some: <A>(predicate: Predicate<A>) => (self: TArray<A>) => STM.STM<never, never, boolean> = internal.some

/**
 * Determine if the array contains a value satisfying a transactional
 * predicate.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const someSTM: <A, R, E>(
  predicate: (value: A) => STM.STM<R, E, boolean>
) => (self: TArray<A>) => STM.STM<R, E, boolean> = internal.someSTM

/**
 * Collects all elements into a chunk.
 *
 * @since 1.0.0
 * @since 1.0.0
 * @category destructors
 */
export const toChunk: <A>(self: TArray<A>) => STM.STM<never, never, Chunk.Chunk<A>> = internal.toChunk

/**
 * Atomically updates all elements using a pure function.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const transform: <A>(f: (value: A) => A) => (self: TArray<A>) => STM.STM<never, never, void> = internal.transform

/**
 * Atomically updates all elements using a transactional effect.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const transformSTM: <A, R, E>(f: (value: A) => STM.STM<R, E, A>) => (self: TArray<A>) => STM.STM<R, E, void> =
  internal.transformSTM

/**
 * Updates element in the array with given function.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const update: <A>(index: number, f: (value: A) => A) => (self: TArray<A>) => STM.STM<never, never, void> =
  internal.update

/**
 * Atomically updates element in the array with given transactional effect.
 *
 * @macro traced
 * @since 1.0.0
 * @category elements
 */
export const updateSTM: <A, R, E>(
  index: number,
  f: (value: A) => STM.STM<R, E, A>
) => (self: TArray<A>) => STM.STM<R, E, void> = internal.updateSTM
