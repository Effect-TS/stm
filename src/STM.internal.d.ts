import type * as FiberId from "@effect/io/Fiber/Id"
import type * as internal from "@effect/io/internal/stm"
import type * as local from "@effect/stm/STM"

/** @internal */
declare module "@effect/stm/STM" {
  interface STM<R, E, A> extends internal.STM<R, E, A> {}
  interface STMDieException extends internal.STMDieException {}
  interface STMFailException<E> extends internal.STMFailException<E> {}
  interface STMRetryException extends internal.STMRetryException {}
  interface STMInterruptException extends internal.STMInterruptException {}
}

/** @internal */
declare module "@effect/io/internal/stm" {
  interface STMRetryException {
    readonly [local.STMRetryExceptionTypeId]: local.STMRetryExceptionTypeId
  }
  interface STMDieException {
    readonly [local.STMDieExceptionTypeId]: local.STMDieExceptionTypeId
    readonly defect: unknown
  }
  interface STMInterruptException {
    readonly [local.STMInterruptExceptionTypeId]: local.STMInterruptExceptionTypeId
    readonly fiberId: FiberId.FiberId
  }
  interface STMFailException<E> {
    readonly [local.STMFailExceptionTypeId]: local.STMFailExceptionTypeId
    readonly error: E
  }
  interface STM<R, E, A> extends local.STM.Variance<R, E, A> {}
}
