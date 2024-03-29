/**
 * @since 1.0.0
 */

import type * as Option from "@effect/data/Option"
import type * as Journal from "@effect/stm/internal/stm/journal"
import type * as TxnId from "@effect/stm/internal/stm/txnId"
import type * as Versioned from "@effect/stm/internal/stm/versioned"
import * as internal from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TRefTypeId: unique symbol = internal.TRefTypeId

/**
 * @since 1.0.0
 * @category symbols
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
 * @category models
 */
export interface TRef<A> extends TRef.Variance<A> {
  /**
   * Note: the method is unbound, exposed only for potential extensions.
   */
  modify<B>(f: (a: A) => readonly [B, A]): STM.STM<never, never, B>
}
/**
 * @internal
 * @since 1.0.0
 */
export interface TRef<A> {
  /** @internal */
  todos: Map<TxnId.TxnId, Journal.Todo>
  /** @internal */
  versioned: Versioned.Versioned<A>
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
 * @category mutations
 */
export const get: <A>(self: TRef<A>) => STM.STM<never, never, A> = internal.get

/**
 * @since 1.0.0
 * @category mutations
 */
export const getAndSet: {
  <A>(value: A): (self: TRef<A>) => STM.STM<never, never, A>
  <A>(self: TRef<A>, value: A): STM.STM<never, never, A>
} = internal.getAndSet

/**
 * @since 1.0.0
 * @category mutations
 */
export const getAndUpdate: {
  <A>(f: (a: A) => A): (self: TRef<A>) => STM.STM<never, never, A>
  <A>(self: TRef<A>, f: (a: A) => A): STM.STM<never, never, A>
} = internal.getAndUpdate

/**
 * @since 1.0.0
 * @category mutations
 */
export const getAndUpdateSome: {
  <A>(f: (a: A) => Option.Option<A>): (self: TRef<A>) => STM.STM<never, never, A>
  <A>(self: TRef<A>, f: (a: A) => Option.Option<A>): STM.STM<never, never, A>
} = internal.getAndUpdateSome

/**
 * @since 1.0.0
 * @category constructors
 */
export const make: <A>(value: A) => STM.STM<never, never, TRef<A>> = internal.make

/**
 * @since 1.0.0
 * @category mutations
 */
export const modify: {
  <A, B>(f: (a: A) => readonly [B, A]): (self: TRef<A>) => STM.STM<never, never, B>
  <A, B>(self: TRef<A>, f: (a: A) => readonly [B, A]): STM.STM<never, never, B>
} = internal.modify

/**
 * @since 1.0.0
 * @category mutations
 */
export const modifySome: {
  <A, B>(fallback: B, f: (a: A) => Option.Option<readonly [B, A]>): (self: TRef<A>) => STM.STM<never, never, B>
  <A, B>(self: TRef<A>, fallback: B, f: (a: A) => Option.Option<readonly [B, A]>): STM.STM<never, never, B>
} = internal.modifySome

/**
 * @since 1.0.0
 * @category mutations
 */
export const set: {
  <A>(value: A): (self: TRef<A>) => STM.STM<never, never, void>
  <A>(self: TRef<A>, value: A): STM.STM<never, never, void>
} = internal.set

/**
 * @since 1.0.0
 * @category mutations
 */
export const setAndGet: {
  <A>(value: A): (self: TRef<A>) => STM.STM<never, never, A>
  <A>(self: TRef<A>, value: A): STM.STM<never, never, A>
} = internal.setAndGet

/**
 * @since 1.0.0
 * @category mutations
 */
export const update: {
  <A>(f: (a: A) => A): (self: TRef<A>) => STM.STM<never, never, void>
  <A>(self: TRef<A>, f: (a: A) => A): STM.STM<never, never, void>
} = internal.update

/**
 * @since 1.0.0
 * @category mutations
 */
export const updateAndGet: {
  <A>(f: (a: A) => A): (self: TRef<A>) => STM.STM<never, never, A>
  <A>(self: TRef<A>, f: (a: A) => A): STM.STM<never, never, A>
} = internal.updateAndGet

/**
 * @since 1.0.0
 * @category mutations
 */
export const updateSome: {
  <A>(f: (a: A) => Option.Option<A>): (self: TRef<A>) => STM.STM<never, never, void>
  <A>(self: TRef<A>, f: (a: A) => Option.Option<A>): STM.STM<never, never, void>
} = internal.updateSome

/**
 * @since 1.0.0
 * @category mutations
 */
export const updateSomeAndGet: {
  <A>(f: (a: A) => Option.Option<A>): (self: TRef<A>) => STM.STM<never, never, A>
  <A>(self: TRef<A>, f: (a: A) => Option.Option<A>): STM.STM<never, never, A>
} = internal.updateSomeAndGet
