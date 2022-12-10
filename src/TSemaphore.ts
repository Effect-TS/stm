/**
 * @since 1.0.0
 */

import type * as Effect from "@effect/io/Effect"
import type * as Scope from "@effect/io/Scope"
import * as internal from "@effect/stm/internal/tSemaphore"
import type * as STM from "@effect/stm/STM"
import type * as TRef from "@effect/stm/TRef"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TSemaphoreTypeId: unique symbol = internal.TSemaphoreTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type TSemaphoreTypeId = typeof TSemaphoreTypeId

/**
 * @macro traced
 * @since 1.0.0
 * @category models
 */
export interface TSemaphore {
  readonly [TSemaphoreTypeId]: TSemaphoreTypeId
  /** @internal */
  readonly permits: TRef.TRef<number>
}

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const acquire: (self: TSemaphore) => STM.STM<never, never, void> = internal.acquire

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const acquireN: (n: number) => (self: TSemaphore) => STM.STM<never, never, void> = internal.acquireN

/**
 * @macro traced
 * @since 1.0.0
 * @category getters
 */
export const available: (self: TSemaphore) => STM.STM<never, never, number> = internal.available

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const make: (permits: number) => STM.STM<never, never, TSemaphore> = internal.make

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const release: (self: TSemaphore) => STM.STM<never, never, void> = internal.release

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const releaseN: (n: number) => (self: TSemaphore) => STM.STM<never, never, void> = internal.releaseN

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const withPermit: (semaphore: TSemaphore) => <R, E, A>(self: Effect.Effect<R, E, A>) => Effect.Effect<R, E, A> =
  internal.withPermit

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const withPermits: (
  permits: number
) => (semaphore: TSemaphore) => <R, E, A>(self: Effect.Effect<R, E, A>) => Effect.Effect<R, E, A> = internal.withPermits

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const withPermitScoped: (self: TSemaphore) => Effect.Effect<Scope.Scope, never, void> = internal.withPermitScoped

/**
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const withPermitsScoped: (permits: number) => (self: TSemaphore) => Effect.Effect<Scope.Scope, never, void> =
  internal.withPermitsScoped

/**
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeMake: (permits: number) => TSemaphore = internal.unsafeMakeSemaphore
