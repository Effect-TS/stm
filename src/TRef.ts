/**
 * @since 1.0.0
 */

import type { Journal, STM } from "@effect/stm/STM"
import type { Option } from "@fp-ts/data/Option"

/** @internal */
import * as internal from "@effect/io/internal/stm/ref"

/**
 * @since 1.0.0
 */
export const TRefTypeId: unique symbol = internal.RefTypeId as unknown as TRefTypeId

/**
 * @since 1.0.0
 */
export type TRefTypeId = typeof TRefTypeId

/**
 * A `TRef<A>` is a purely functional description of a mutable reference that can
 * be modified as part of a transactional effect. The fundamental operations of
 * a `TRef` are `set` and `get`. `set` transactionally sets the reference to a
 * new value. `get` gets the current value of the reference.
 *
 * NOTE: While `TRef<A>` provides the transactional equivalent of a mutable
 * reference, the value inside the `TRef` should be immutable.
 *
 * @since 1.0.0
 */
export interface TRef<A> extends TRef.Variance<A> {
  /**
   * Note: the method is unbound, exposed only for potential extensions.
   */
  modify<B>(f: (a: A) => readonly [B, A]): STM<never, never, B>
}

/**
 * @since 1.0.0
 */
export namespace TRef {
  /**
   * @since 1.0.0
   */
  export interface Variance<A> {
    readonly [TRefTypeId]: {
      readonly _A: (_: never) => A
    }
  }
}

/**
 * @since 1.0.0
 */
export const get: <A>(self: TRef<A>) => STM<never, never, A> = internal.get

/**
 * @since 1.0.0
 */
export const getAndSet: <A>(value: A) => (self: TRef<A>) => STM<never, never, A> = internal.getAndSet

/**
 * @since 1.0.0
 */
export const getAndUpdate: <A>(f: (a: A) => A) => (self: TRef<A>) => STM<never, never, A> = internal.getAndUpdate

/**
 * @since 1.0.0
 */
export const getAndUpdateSome: <A>(f: (a: A) => Option<A>) => (self: TRef<A>) => STM<never, never, A> =
  internal.getAndUpdateSome

/**
 * @since 1.0.0
 */
export const make: <A>(evaluate: () => A) => STM<never, never, TRef<A>> = internal.make

/**
 * @since 1.0.0
 */
export const modify: <A, B>(f: (a: A) => readonly [B, A]) => (self: TRef<A>) => STM<never, never, B> = internal.modify

/**
 * @since 1.0.0
 */
export const modifySome: <A, B>(
  fallback: B,
  f: (a: A) => Option<readonly [B, A]>
) => (self: TRef<A>) => STM<never, never, B> = internal.modifySome

/**
 * @since 1.0.0
 */
export const set: <A>(value: A) => (self: TRef<A>) => STM<never, never, void> = internal.set

/**
 * @since 1.0.0
 */
export const setAndGet: <A>(value: A) => (self: TRef<A>) => STM<never, never, A> = internal.setAndGet

/**
 * @since 1.0.0
 */
export const unsafeGet: (journal: Journal) => <A>(self: TRef<A>) => A = internal.unsafeGet

/**
 * @since 1.0.0
 */
export const unsafeSet: <A>(value: A, journal: Journal) => (self: TRef<A>) => void = internal.unsafeSet

/**
 * @since 1.0.0
 */
export const update: <A>(f: (a: A) => A) => (self: TRef<A>) => STM<never, never, void> = internal.update

/**
 * @since 1.0.0
 */
export const updateAndGet: <A>(f: (a: A) => A) => (self: TRef<A>) => STM<never, never, A> = internal.updateAndGet

/**
 * @since 1.0.0
 */
export const updateSome: <A>(f: (a: A) => Option<A>) => (self: TRef<A>) => STM<never, never, void> = internal.updateSome

/**
 * @since 1.0.0
 */
export const updateSomeAndGet: <A>(f: (a: A) => Option<A>) => (self: TRef<A>) => STM<never, never, A> =
  internal.updateSomeAndGet
