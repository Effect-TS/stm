/**
 * @since 1.0.0
 */
import type * as Either from "@effect/data/Either"
import type * as Option from "@effect/data/Option"
import * as internal from "@effect/stm/internal/tDeferred"
import type * as STM from "@effect/stm/STM"
import type * as TRef from "@effect/stm/TRef"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TDeferredTypeId: unique symbol = internal.TDeferredTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type TDeferredTypeId = typeof TDeferredTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface TDeferred<E, A> extends TDeferred.Variance<E, A> {}
/**
 * @internal
 * @since 1.0.0
 */
export interface TDeferred<E, A> {
  /** @internal */
  readonly ref: TRef.TRef<Option.Option<Either.Either<E, A>>>
}

/**
 * @since 1.0.0
 */
export declare namespace TDeferred {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<E, A> {
    readonly [TDeferredTypeId]: {
      readonly _E: (_: never) => E
      readonly _A: (_: never) => A
    }
  }
}

const _await: <E, A>(self: TDeferred<E, A>) => STM.STM<never, E, A> = internal._await
export {
  /**
   * @since 1.0.0
   * @category getters
   */
  _await as await
}

/**
 * @since 1.0.0
 * @category mutations
 */
export const done: {
  <E, A>(either: Either.Either<E, A>): (self: TDeferred<E, A>) => STM.STM<never, never, boolean>
  <E, A>(self: TDeferred<E, A>, either: Either.Either<E, A>): STM.STM<never, never, boolean>
} = internal.done

/**
 * @since 1.0.0
 * @category mutations
 */
export const fail: {
  <E>(error: E): <A>(self: TDeferred<E, A>) => STM.STM<never, never, boolean>
  <E, A>(self: TDeferred<E, A>, error: E): STM.STM<never, never, boolean>
} = internal.fail

/**
 * @since 1.0.0
 * @category constructors
 */
export const make: <E, A>() => STM.STM<never, never, TDeferred<E, A>> = internal.make

/**
 * @since 1.0.0
 * @category getters
 */
export const poll: <E, A>(self: TDeferred<E, A>) => STM.STM<never, never, Option.Option<Either.Either<E, A>>> =
  internal.poll

/**
 * @since 1.0.0
 * @category mutations
 */
export const succeed: {
  <A>(value: A): <E>(self: TDeferred<E, A>) => STM.STM<never, never, boolean>
  <E, A>(self: TDeferred<E, A>, value: A): STM.STM<never, never, boolean>
} = internal.succeed
