/**
 * @since 1.0.0
 */

import type * as Effect from "@effect/io/Effect"
import type * as FiberId from "@effect/io/Fiber/Id"
import type * as Entry from "@effect/stm/STM/Entry"
import type * as TRef from "@effect/stm/TRef"
import type * as Context from "@fp-ts/data/Context"

/** @internal */
import * as internal from "@effect/io/internal/stm"

/**
 * @since 1.0.0
 */
export const STMTypeId: unique symbol = internal.STMTypeId as unknown as STMTypeId

/**
 * @since 1.0.0
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
 */
export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {}

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
export const catchAll: <E, R1, E1, B>(
  f: (e: E) => STM<R1, E1, B>
) => <R, A>(self: STM<R, E, A>) => STM<R1 | R, E1, B | A> = internal.catchAll

/**
 * @since 1.0.0
 */
export const commit: <R, E, A>(self: STM<R, E, A>) => Effect.Effect<R, E, A> = internal.commit

/**
 * @since 1.0.0
 */
export const die: (defect: unknown) => STM<never, never, never> = internal.die

/**
 * @since 1.0.0
 */
export type Journal = Map<TRef.TRef<unknown>, Entry.Entry>

/**
 * @since 1.0.0
 */
export const effect: <R, A>(
  f: (journal: Journal, fiberId: FiberId.FiberId, context: Context.Context<R>) => A
) => STM<R, never, A> = internal.effect

/**
 * @since 1.0.0
 */
export const ensuring: <R1, B>(
  finalizer: STM<R1, never, B>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E, A> = internal.ensuring

/**
 * @since 1.0.0
 */
export const fail: <E>(error: E) => STM<never, E, never> = internal.fail

/**
 * @since 1.0.0
 */
export const flatMap: <A, R1, E1, A2>(
  f: (a: A) => STM<R1, E1, A2>
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2> = internal.flatMap

/**
 * @since 1.0.0
 */
export const foldSTM: <E, R1, E1, A1, A, R2, E2, A2>(
  onFailure: (e: E) => STM<R1, E1, A1>,
  onSuccess: (a: A) => STM<R2, E2, A2>
) => <R>(self: STM<R, E, A>) => STM<R1 | R2 | R, E1 | E2, A1 | A2> = internal.foldSTM

/**
 * @since 1.0.0
 */
export const interrupt: () => STM<never, never, never> = internal.interrupt

/**
 * @since 1.0.0
 */
export const STMDieExceptionTypeId: unique symbol = internal.STMDieExceptionTypeId as unknown as STMDieExceptionTypeId

/**
 * @since 1.0.0
 */
export type STMDieExceptionTypeId = typeof STMDieExceptionTypeId

/**
 * @since 1.0.0
 */
export interface STMDieException {
  readonly [STMDieExceptionTypeId]: STMDieExceptionTypeId
  readonly defect: unknown
}

/**
 * @since 1.0.0
 */
export const isDieException: (u: unknown) => u is STMDieException = internal.isDieException

/**
 * @since 1.0.0
 */
export const STMFailExceptionTypeId: unique symbol = internal
  .STMFailExceptionTypeId as unknown as STMFailExceptionTypeId

/**
 * @since 1.0.0
 */
export type STMFailExceptionTypeId = typeof STMFailExceptionTypeId

/**
 * @since 1.0.0
 */
export interface STMFailException<E> {
  readonly [STMFailExceptionTypeId]: STMFailExceptionTypeId
  readonly error: E
}

/**
 * @since 1.0.0
 */
export const isFailException: (u: unknown) => u is STMFailException<unknown> = internal.isFailException

/**
 * @since 1.0.0
 */
export const STMInterruptExceptionTypeId: unique symbol = internal
  .STMInterruptExceptionTypeId as unknown as STMInterruptExceptionTypeId

/**
 * @since 1.0.0
 */
export type STMInterruptExceptionTypeId = typeof STMInterruptExceptionTypeId

/**
 * @since 1.0.0
 */
export interface STMInterruptException {
  readonly [STMInterruptExceptionTypeId]: STMInterruptExceptionTypeId
  readonly fiberId: FiberId.FiberId
}

/**
 * @since 1.0.0
 */
export const isInterruptException: (u: unknown) => u is STMInterruptException = internal.isInterruptException

/**
 * @since 1.0.0
 */
export const STMRetryExceptionTypeId: unique symbol = internal
  .STMRetryExceptionTypeId as unknown as STMRetryExceptionTypeId

/**
 * @since 1.0.0
 */
export type STMRetryExceptionTypeId = typeof STMRetryExceptionTypeId

/**
 * @since 1.0.0
 */
export interface STMRetryException {
  readonly [STMRetryExceptionTypeId]: STMRetryExceptionTypeId
}

/**
 * @since 1.0.0
 */
export const isRetryException: (u: unknown) => u is STMRetryException = internal.isRetryException

/**
 * @since 1.0.0
 */
export const map: <A, B>(f: (a: A) => B) => <R, E>(self: STM<R, E, A>) => STM<R, E, B> = internal.map

/**
 * @since 1.0.0
 */
export const orTry: <R1, E1, A1>(
  that: () => STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1 | A> = internal.orTry

/**
 * @since 1.0.0
 */
export const provideSomeEnvironment: <R0, R>(
  f: (context: Context.Context<R0>) => Context.Context<R>
) => <E, A>(self: STM<R, E, A>) => STM<R0, E, A> = internal.provideSomeEnvironment

/**
 * @since 1.0.0
 */
export const retry: () => STM<never, never, never> = internal.retry

/**
 * @since 1.0.0
 */
export const succeed: <A>(value: A) => STM<never, never, A> = internal.succeed

/**
 * @since 1.0.0
 */
export const sync: <A>(evaluate: () => A) => STM<never, never, A> = internal.sync

/**
 * @since 1.0.0
 */
export const zip: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, readonly [A, A1]> = internal.zip

/**
 * @since 1.0.0
 */
export const zipLeft: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A> = internal.zipLeft

/**
 * @since 1.0.0
 */
export const zipRight: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1> = internal.zipRight

/**
 * @since 1.0.0
 */
export const zipWith: <R1, E1, A1, A, A2>(
  that: STM<R1, E1, A1>,
  f: (a: A, b: A1) => A2
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2> = internal.zipWith
