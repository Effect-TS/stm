/**
 * @since 1.0.0
 */

import type { Effect } from "@effect/io/Effect"
import type { Scope } from "@effect/io/Scope"
import type { STM } from "@effect/stm/STM"

/** @internal */
import * as circular from "@effect/io/internal/effect/circular"
/** @internal */
import * as internal from "@effect/io/internal/semaphore"

/**
 * @since 1.0.0
 */
export const TSemaphoreTypeId: unique symbol = circular.SemaphoreTypeId as unknown as TSemaphoreTypeId

/**
 * @since 1.0.0
 */
export type TSemaphoreTypeId = typeof TSemaphoreTypeId

/**
 * @since 1.0.0
 */
export interface TSemaphore {
  readonly [TSemaphoreTypeId]: TSemaphoreTypeId
}

/**
 * @since 1.0.0
 */
export const acquire: (self: TSemaphore) => STM<never, never, void> = internal.acquire

/**
 * @since 1.0.0
 */
export const available: (self: TSemaphore) => STM<never, never, number> = internal.available

/**
 * @since 1.0.0
 */
export const make: (permits: number) => STM<never, never, TSemaphore> = internal.make

/**
 * @since 1.0.0
 */
export const release: (self: TSemaphore) => STM<never, never, void> = internal.release

/**
 * @since 1.0.0
 */
export const withPermit: (semaphore: TSemaphore) => <R, E, A>(self: Effect<R, E, A>) => Effect<R, E, A> =
  internal.withPermit

/**
 * @since 1.0.0
 */
export const withPermitScoped: (self: TSemaphore) => Effect<Scope, never, void> = internal.withPermitScoped

/**
 * @since 1.0.0
 */
export const unsafeMake: (permits: number) => TSemaphore = circular.unsafeMakeSemaphore

/**
 * @since 1.0.0
 */
export const acquireN: (n: number) => (self: TSemaphore) => STM<never, never, void> = circular.acquireN

/**
 * @since 1.0.0
 */
export const releaseN: (n: number) => (self: TSemaphore) => STM<never, never, void> = circular.releaseN

/**
 * @since 1.0.0
 */
export const withPermits: (
  permits: number
) => (semaphore: TSemaphore) => <R, E, A>(self: Effect<R, E, A>) => Effect<R, E, A> = circular.withPermits

/**
 * @since 1.0.0
 */
export const withPermitsScoped: (permits: number) => (self: TSemaphore) => Effect<Scope, never, void> =
  circular.withPermitsScoped
