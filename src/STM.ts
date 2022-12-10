/**
 * @since 1.0.0
 */

import type * as Effect from "@effect/io/Effect"
import * as core from "@effect/stm/internal/core"
import type * as Context from "@fp-ts/data/Context"

/**
 * @since 1.0.0
 * @category symbols
 */
export const STMTypeId: unique symbol = core.STMTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type STMTypeId = typeof STMTypeId

/**
 * `STM<R, E, A>` represents an effect that can be performed transactionally,
 *  resulting in a failure `E` or a value `A` that may require an environment
 *  `R` to execute.
 *
 * Software Transactional Memory is a technique which allows composition of
 * arbitrary atomic operations.  It is the software analog of transactions in
 * database systems.
 *
 * The API is lifted directly from the Haskell package Control.Concurrent.STM
 * although the implementation does not resemble the Haskell one at all.
 *
 * See http://hackage.haskell.org/package/stm-2.5.0.0/docs/Control-Concurrent-STM.html
 *
 * STM in Haskell was introduced in:
 *
 * Composable memory transactions, by Tim Harris, Simon Marlow, Simon Peyton
 * Jones, and Maurice Herlihy, in ACM Conference on Principles and Practice of
 * Parallel Programming 2005.
 *
 * See https://www.microsoft.com/en-us/research/publication/composable-memory-transactions/
 *
 * See also:
 *  Lock Free Data Structures using STMs in Haskell, by Anthony Discolo, Tim
 *  Harris, Simon Marlow, Simon Peyton Jones, Satnam Singh) FLOPS 2006: Eighth
 *  International Symposium on Functional and Logic Programming, Fuji Susono,
 *  JAPAN, April 2006
 *
 *  https://www.microsoft.com/en-us/research/publication/lock-free-data-structures-using-stms-in-haskell/
 *
 * The implemtation is based on the ZIO STM module, while JS environments have
 * no race conditions from multiple threads STM provides greater benefits for
 * synchronization of Fibers and transactional data-types can be quite useful.
 *
 * @since 1.0.0
 * @category models
 */
export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {
  /** @internal */
  trace: string | undefined
  /** @internal */
  traced(trace: string | undefined): STM<R, E, A>
  /** @internal */
  commit(): Effect.Effect<R, E, A>
}

/**
 * @since 1.0.0
 */
export declare namespace STM {
  /**
   * @since 1.0.0
   * @category models
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
 * @macro traced
 * @since 1.0.0
 * @category error handling
 */
export const catchAll: <E, R1, E1, B>(
  f: (e: E) => STM<R1, E1, B>
) => <R, A>(self: STM<R, E, A>) => STM<R1 | R, E1, B | A> = core.catchAll

/**
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const commit: <R, E, A>(self: STM<R, E, A>) => Effect.Effect<R, E, A> = core.commit

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const die: (defect: unknown) => STM<never, never, never> = core.die

/**
 * @macro traced
 * @since 1.0.0
 * @category finalization
 */
export const ensuring: <R1, B>(
  finalizer: STM<R1, never, B>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E, A> = core.ensuring

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const fail: <E>(error: E) => STM<never, E, never> = core.fail

/**
 * @macro traced
 * @since 1.0.0
 * @category sequencing
 */
export const flatMap: <A, R1, E1, A2>(
  f: (a: A) => STM<R1, E1, A2>
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2> = core.flatMap

/**
 * @macro traced
 * @since 1.0.0
 * @category folding
 */
export const foldSTM: <E, R1, E1, A1, A, R2, E2, A2>(
  onFailure: (e: E) => STM<R1, E1, A1>,
  onSuccess: (a: A) => STM<R2, E2, A2>
) => <R>(self: STM<R, E, A>) => STM<R1 | R2 | R, E1 | E2, A1 | A2> = core.foldSTM

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const interrupt: () => STM<never, never, never> = core.interrupt

/**
 * @macro traced
 * @since 1.0.0
 * @category mapping
 */
export const map: <A, B>(f: (a: A) => B) => <R, E>(self: STM<R, E, A>) => STM<R, E, B> = core.map

/**
 * @macro traced
 * @since 1.0.0
 * @category error handling
 */
export const orTry: <R1, E1, A1>(
  that: () => STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1 | A> = core.orTry

/**
 * @macro traced
 * @since 1.0.0
 * @category environment
 */
export const provideSomeEnvironment: <R0, R>(
  f: (context: Context.Context<R0>) => Context.Context<R>
) => <E, A>(self: STM<R, E, A>) => STM<R0, E, A> = core.provideSomeEnvironment

/**
 * @macro traced
 * @since 1.0.0
 * @category error handling
 */
export const retry: () => STM<never, never, never> = core.retry

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const succeed: <A>(value: A) => STM<never, never, A> = core.succeed

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const sync: <A>(evaluate: () => A) => STM<never, never, A> = core.sync

/**
 * @macro traced
 * @since 1.0.0
 * @category zipping
 */
export const zip: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, readonly [A, A1]> = core.zip

/**
 * @macro traced
 * @since 1.0.0
 * @category zipping
 */
export const zipLeft: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A> = core.zipLeft

/**
 * @macro traced
 * @since 1.0.0
 * @category zipping
 */
export const zipRight: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1> = core.zipRight

/**
 * @macro traced
 * @since 1.0.0
 * @category zipping
 */
export const zipWith: <R1, E1, A1, A, A2>(
  that: STM<R1, E1, A1>,
  f: (a: A, b: A1) => A2
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2> = core.zipWith
