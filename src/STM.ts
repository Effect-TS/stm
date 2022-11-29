/**
 * @since 1.0.0
 */

import type * as Effect from "@effect/io/Effect"

/** @internal */
import * as internal from "@effect/io/internal/stm"
/** @internal */
import type * as local from "@effect/stm/STM"

/**
 * @since 1.0.0
 */
export const STMTypeId = Symbol.for("@effect/stm/STM")
/**
 * @since 1.0.0
 */
export type STMTypeId = typeof STMTypeId

/**
 * @since 1.0.0
 */
export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {}

/** @internal */
declare module "@effect/io/internal/stm" {
  export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {
    readonly [local.STMTypeId]: {
      readonly _R: (_: never) => R
      readonly _E: (_: never) => E
      readonly _A: (_: never) => A
    }
  }
}

/**
 * @since 1.0.0
 */
export declare namespace STM {
  /**
   * @since 1.0.0
   */
  export interface Variance<R, E, A> {
    readonly [STMTypeId]: {
      readonly _R: (_: never) => R
      readonly _E: (_: never) => E
      readonly _A: (_: never) => A
    }
  }
}

/**
 * @since 1.0.0
 */
export const succeed: <A>(value: A) => STM<never, never, A> = internal.succeed
