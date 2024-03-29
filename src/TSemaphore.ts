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
 * @since 1.0.0
 * @category models
 */
export interface TSemaphore extends TSemaphore.Proto {}
/**
 * @internal
 * @since 1.0.0
 */
export interface TSemaphore {
  /** @internal */
  readonly permits: TRef.TRef<number>
}

/**
 * @since 1.0.0
 */
export declare namespace TSemaphore {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Proto {
    readonly [TSemaphoreTypeId]: TSemaphoreTypeId
  }
}

/**
 * @since 1.0.0
 * @category mutations
 */
export const acquire: (self: TSemaphore) => STM.STM<never, never, void> = internal.acquire

/**
 * @since 1.0.0
 * @category mutations
 */
export const acquireN: {
  (n: number): (self: TSemaphore) => STM.STM<never, never, void>
  (self: TSemaphore, n: number): STM.STM<never, never, void>
} = internal.acquireN

/**
 * @since 1.0.0
 * @category getters
 */
export const available: (self: TSemaphore) => STM.STM<never, never, number> = internal.available

/**
 * @since 1.0.0
 * @category constructors
 */
export const make: (permits: number) => STM.STM<never, never, TSemaphore> = internal.make

/**
 * @since 1.0.0
 * @category mutations
 */
export const release: (self: TSemaphore) => STM.STM<never, never, void> = internal.release

/**
 * @since 1.0.0
 * @category mutations
 */
export const releaseN: {
  (n: number): (self: TSemaphore) => STM.STM<never, never, void>
  (self: TSemaphore, n: number): STM.STM<never, never, void>
} = internal.releaseN

/**
 * @since 1.0.0
 * @category mutations
 */
export const withPermit: {
  (semaphore: TSemaphore): <R, E, A>(self: Effect.Effect<R, E, A>) => Effect.Effect<R, E, A>
  <R, E, A>(self: Effect.Effect<R, E, A>, semaphore: TSemaphore): Effect.Effect<R, E, A>
} = internal.withPermit

/**
 * @since 1.0.0
 * @category mutations
 */
export const withPermits: {
  (semaphore: TSemaphore, permits: number): <R, E, A>(self: Effect.Effect<R, E, A>) => Effect.Effect<R, E, A>
  <R, E, A>(self: Effect.Effect<R, E, A>, semaphore: TSemaphore, permits: number): Effect.Effect<R, E, A>
} = internal.withPermits

/**
 * @since 1.0.0
 * @category mutations
 */
export const withPermitScoped: (self: TSemaphore) => Effect.Effect<Scope.Scope, never, void> = internal.withPermitScoped

/**
 * @since 1.0.0
 * @category mutations
 */
export const withPermitsScoped: {
  (permits: number): (self: TSemaphore) => Effect.Effect<Scope.Scope, never, void>
  (self: TSemaphore, permits: number): Effect.Effect<Scope.Scope, never, void>
} = internal.withPermitsScoped

/**
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeMake: (permits: number) => TSemaphore = internal.unsafeMakeSemaphore
