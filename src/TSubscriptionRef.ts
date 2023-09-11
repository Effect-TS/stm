/**
 * @since 1.0.0
 */
import type * as Option from "@effect/data/Option"
import * as internal from "@effect/stm/internal/tSubscriptionRef"
import type * as STM from "@effect/stm/STM"
import type * as THub from "@effect/stm/THub"
import type * as TRef from "@effect/stm/TRef"
import type * as Stream from "@effect/stream/Stream"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TSubscriptionRefTypeId: unique symbol = internal.TSubscriptionRefTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type TSubscriptionRefTypeId = typeof TSubscriptionRefTypeId

/**
 * A `TSubscriptionRef<A>` is a `TRef` that can be subscribed to in order to
 * receive the current value as well as all committed changes to the value.
 *
 * @since 1.0.0
 * @category models
 */
export interface TSubscriptionRef<A> extends TSubscriptionRef.Variance<A> {
  /** @internal */
  readonly ref: TRef.TRef<A>
  /** @internal */
  readonly hub: THub.THub<A>
  /**
   * A stream containing the current value of the `TRef` as well as all comitted
   * changes to that value.
   */
  readonly changes: Stream.Stream<never, never, A>
}

/**
 * @since 1.0.0
 */
export declare namespace TSubscriptionRef {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<A> {
    readonly [TSubscriptionRefTypeId]: {
      readonly _A: (_: never) => A
    }
  }
}

/**
 * @since 1.0.0
 * @category getters
 */
export const get: <A>(self: TSubscriptionRef<A>) => STM.STM<never, never, A> = internal.get

/**
 * @since 1.0.0
 * @category utils
 */
export const getAndSet: {
  <A>(value: A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, value: A): STM.STM<never, never, A>
} = internal.getAndSet

/**
 * @since 1.0.0
 * @category utils
 */
export const getAndUpdate: {
  <A>(f: (a: A) => A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => A): STM.STM<never, never, A>
} = internal.getAndUpdate

/**
 * @since 1.0.0
 * @category utils
 */
export const getAndUpdateSome: {
  <A>(pf: (a: A) => Option.Option<A>): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, pf: (a: A) => Option.Option<A>): STM.STM<never, never, A>
} = internal.getAndUpdateSome

/**
 * Creates a new `TSubscriptionRef` with the specified value.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make: <A>(value: A) => STM.STM<never, never, TSubscriptionRef<A>> = internal.make

/**
 * @since 1.0.0
 * @category utils
 */
export const modify: {
  <A, B>(f: (a: A) => readonly [B, A]): (self: TSubscriptionRef<A>) => STM.STM<never, never, B>
  <A, B>(self: TSubscriptionRef<A>, f: (a: A) => readonly [B, A]): STM.STM<never, never, B>
} = internal.modify

/**
 * @since 1.0.0
 * @category utils
 */
export const modifySome: {
  <B, A>(
    fallback: B,
    pf: (a: A) => Option.Option<readonly [B, A]>
  ): (self: TSubscriptionRef<A>) => STM.STM<never, never, B>
  <A, B>(
    self: TSubscriptionRef<A>,
    fallback: B,
    pf: (a: A) => Option.Option<readonly [B, A]>
  ): STM.STM<never, never, B>
} = internal.modifySome

/**
 * @since 1.0.0
 * @category utils
 */
export const set: {
  <A>(value: A): (self: TSubscriptionRef<A>) => STM.STM<never, never, void>
  <A>(self: TSubscriptionRef<A>, value: A): STM.STM<never, never, void>
} = internal.set

/**
 * @since 1.0.0
 * @category utils
 */
export const setAndGet: {
  <A>(value: A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, value: A): STM.STM<never, never, A>
} = internal.setAndGet

/**
 * @since 1.0.0
 * @category utils
 */
export const update: {
  <A>(f: (a: A) => A): (self: TSubscriptionRef<A>) => STM.STM<never, never, void>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => A): STM.STM<never, never, void>
} = internal.update

/**
 * @since 1.0.0
 * @category utils
 */
export const updateAndGet: {
  <A>(f: (a: A) => A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => A): STM.STM<never, never, A>
} = internal.updateAndGet

/**
 * @since 1.0.0
 * @category utils
 */
export const updateSome: {
  <A>(f: (a: A) => Option.Option<A>): (self: TSubscriptionRef<A>) => STM.STM<never, never, void>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => Option.Option<A>): STM.STM<never, never, void>
} = internal.updateSome

/**
 * @since 1.0.0
 * @category utils
 */
export const updateSomeAndGet: {
  <A>(pf: (a: A) => Option.Option<A>): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, pf: (a: A) => Option.Option<A>): STM.STM<never, never, A>
} = internal.updateSomeAndGet
