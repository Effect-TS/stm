import type * as FiberId from "@effect/io/Fiber/Id"
import type { StackAnnotation } from "@effect/io/internal/cause"
import * as OpCodes from "@effect/stm/internal/opCodes/tExit"
import * as Equal from "@fp-ts/data/Equal"
import { pipe } from "@fp-ts/data/Function"

/** @internal */
const TExitSymbolKey = "@effect/io/TExit"

/** @internal */
export const TExitTypeId = Symbol.for(TExitSymbolKey)

/** @internal */
export type TExitTypeId = typeof TExitTypeId

/** @internal */
export type TExit<E, A> = Fail<E> | Die | Interrupt | Succeed<A> | Retry

/** @internal */
export declare namespace TExit {
  /** @internal */
  export interface Variance<E, A> {
    readonly [TExitTypeId]: {
      readonly _E: (_: never) => E
      readonly _A: (_: never) => A
    }
  }
}

/** @internal */
const variance = {
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
export interface Fail<E> extends TExit.Variance<E, never>, Equal.Equal {
  readonly _tag: OpCodes.OP_FAIL
  readonly error: E
  readonly annotation: StackAnnotation
}

/** @internal */
export interface Die extends TExit.Variance<never, never>, Equal.Equal {
  readonly _tag: OpCodes.OP_DIE
  readonly defect: unknown
  readonly annotation: StackAnnotation
}

/** @internal */
export interface Interrupt extends TExit.Variance<never, never>, Equal.Equal {
  readonly _tag: OpCodes.OP_INTERRUPT
  readonly fiberId: FiberId.FiberId
  readonly annotation: StackAnnotation
}

/** @internal */
export interface Succeed<A> extends TExit.Variance<never, A>, Equal.Equal {
  readonly _tag: OpCodes.OP_SUCCEED
  readonly value: A
}

/** @internal */
export interface Retry extends TExit.Variance<never, never>, Equal.Equal {
  readonly _tag: OpCodes.OP_RETRY
}

/** @internal */
export const isExit = (u: unknown): u is TExit<unknown, unknown> => {
  return typeof u === "object" && u != null && TExitTypeId in u
}

/** @internal */
export const isFail = <E, A>(self: TExit<E, A>): self is Fail<E> => {
  return self._tag === OpCodes.OP_FAIL
}

/** @internal */
export const isDie = <E, A>(self: TExit<E, A>): self is Die => {
  return self._tag === OpCodes.OP_DIE
}

/** @internal */
export const isInterrupt = <E, A>(self: TExit<E, A>): self is Interrupt => {
  return self._tag === OpCodes.OP_INTERRUPT
}

/** @internal */
export const isSuccess = <E, A>(self: TExit<E, A>): self is Succeed<A> => {
  return self._tag === OpCodes.OP_SUCCEED
}

/** @internal */
export const isRetry = <E, A>(self: TExit<E, A>): self is Retry => {
  return self._tag === OpCodes.OP_RETRY
}

/** @internal */
export const fail = <E>(error: E, annotation: StackAnnotation): TExit<E, never> => ({
  [TExitTypeId]: variance,
  _tag: OpCodes.OP_FAIL,
  error,
  annotation,
  [Equal.symbolHash](): number {
    return pipe(
      Equal.hash(TExitSymbolKey),
      Equal.hashCombine(Equal.hash(OpCodes.OP_FAIL)),
      Equal.hashCombine(Equal.hash(error))
    )
  },
  [Equal.symbolEqual](that: unknown): boolean {
    return isExit(that) && that._tag === OpCodes.OP_FAIL && Equal.equals(error, that.error)
  }
})

/** @internal */
export const die = (defect: unknown, annotation: StackAnnotation): TExit<never, never> => ({
  [TExitTypeId]: variance,
  _tag: OpCodes.OP_DIE,
  defect,
  annotation,
  [Equal.symbolHash](): number {
    return pipe(
      Equal.hash(TExitSymbolKey),
      Equal.hashCombine(Equal.hash(OpCodes.OP_DIE)),
      Equal.hashCombine(Equal.hash(defect))
    )
  },
  [Equal.symbolEqual](that: unknown): boolean {
    return isExit(that) && that._tag === OpCodes.OP_DIE && Equal.equals(defect, that.defect)
  }
})

/** @internal */
export const interrupt = (fiberId: FiberId.FiberId, annotation: StackAnnotation): TExit<never, never> => ({
  [TExitTypeId]: variance,
  _tag: OpCodes.OP_INTERRUPT,
  fiberId,
  annotation,
  [Equal.symbolHash](): number {
    return pipe(
      Equal.hash(TExitSymbolKey),
      Equal.hashCombine(Equal.hash(OpCodes.OP_INTERRUPT)),
      Equal.hashCombine(Equal.hash(fiberId))
    )
  },
  [Equal.symbolEqual](that: unknown): boolean {
    return isExit(that) && that._tag === OpCodes.OP_INTERRUPT && Equal.equals(fiberId, that.fiberId)
  }
})

/** @internal */
export const succeed = <A>(value: A): TExit<never, A> => ({
  [TExitTypeId]: variance,
  _tag: OpCodes.OP_SUCCEED,
  value,
  [Equal.symbolHash](): number {
    return pipe(
      Equal.hash(TExitSymbolKey),
      Equal.hashCombine(Equal.hash(OpCodes.OP_SUCCEED)),
      Equal.hashCombine(Equal.hash(value))
    )
  },
  [Equal.symbolEqual](that: unknown): boolean {
    return isExit(that) && that._tag === OpCodes.OP_SUCCEED && Equal.equals(value, that.value)
  }
})

/** @internal */
const retryHash = Equal.hashRandom({ op: OpCodes.OP_RETRY })

/** @internal */
export const retry: TExit<never, never> = ({
  [TExitTypeId]: variance,
  _tag: OpCodes.OP_RETRY,
  [Equal.symbolHash](): number {
    return pipe(
      Equal.hash(TExitSymbolKey),
      Equal.hashCombine(Equal.hash(OpCodes.OP_RETRY)),
      Equal.hashCombine(Equal.hash(retryHash))
    )
  },
  [Equal.symbolEqual](that: unknown): boolean {
    return isExit(that) && isRetry(that)
  }
})

/** @internal */
export const unit = (): TExit<never, void> => succeed(undefined)
