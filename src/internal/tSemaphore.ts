import * as Cause from "@effect/io/Cause"
import { getCallTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import type * as Scope from "@effect/io/Scope"
import * as core from "@effect/stm/internal/core"
import * as tRef from "@effect/stm/internal/tRef"
import * as STM from "@effect/stm/STM"
import type * as TRef from "@effect/stm/TRef"
import type * as TSemaphore from "@effect/stm/TSemaphore"
import { pipe } from "@fp-ts/data/Function"

/** @internal */
const TSemaphoreSymbolKey = "@effect/stm/TSemaphore"

/** @internal */
export const TSemaphoreTypeId: TSemaphore.TSemaphoreTypeId = Symbol.for(
  TSemaphoreSymbolKey
) as TSemaphore.TSemaphoreTypeId

/** @internal */
class TSemaphoreImpl implements TSemaphore.TSemaphore {
  readonly [TSemaphoreTypeId]: TSemaphore.TSemaphoreTypeId = TSemaphoreTypeId
  constructor(readonly permits: TRef.TRef<number>) {}
}

/**
 * @macro traced
 * @internal
 */
export const make = (permits: number): STM.STM<never, never, TSemaphore.TSemaphore> => {
  const trace = getCallTrace()
  return pipe(
    tRef.make(permits),
    STM.map((permits) => new TSemaphoreImpl(permits))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const acquire = (self: TSemaphore.TSemaphore): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return pipe(self, acquireN(1)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const acquireN = (n: number) => {
  const trace = getCallTrace()
  return (self: TSemaphore.TSemaphore): STM.STM<never, never, void> => {
    return core.withSTMRuntime((driver) => {
      if (n < 0) {
        throw Cause.IllegalArgumentException(`Unexpected negative value ${n} passed to Semaphore.acquireN`)
      }
      const value = pipe(self.permits, tRef.unsafeGet(driver.journal))
      if (value < n) {
        return STM.retry()
      } else {
        return STM.succeed(pipe(self.permits, tRef.unsafeSet(value - n, driver.journal)))
      }
    }).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export function available(self: TSemaphore.TSemaphore): STM.STM<never, never, number> {
  const trace = getCallTrace()
  return tRef.get(self.permits).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const release = (self: TSemaphore.TSemaphore): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return pipe(self, releaseN(1)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const releaseN = (n: number) => {
  const trace = getCallTrace()
  return (self: TSemaphore.TSemaphore): STM.STM<never, never, void> => {
    return core.withSTMRuntime((driver) => {
      if (n < 0) {
        throw Cause.IllegalArgumentException(`Unexpected negative value ${n} passed to Semaphore.releaseN`)
      }
      const current = pipe(self.permits, tRef.unsafeGet(driver.journal))
      return STM.succeed(pipe(self.permits, tRef.unsafeSet(current + n, driver.journal)))
    }).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const withPermit = (semaphore: TSemaphore.TSemaphore) => {
  const trace = getCallTrace()
  return <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E, A> => {
    return pipe(self, withPermits(1)(semaphore)).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const withPermits = (permits: number) => {
  const trace = getCallTrace()
  return (semaphore: TSemaphore.TSemaphore) => {
    return <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E, A> => {
      return Effect.uninterruptibleMask((restore) =>
        pipe(
          restore(core.commit(acquireN(permits)(semaphore))),
          Effect.zipRight(
            pipe(
              restore(self),
              Effect.ensuring(core.commit(releaseN(permits)(semaphore)))
            )
          )
        )
      ).traced(trace)
    }
  }
}

/**
 * @macro traced
 * @internal
 */
export const withPermitScoped = (self: TSemaphore.TSemaphore): Effect.Effect<Scope.Scope, never, void> => {
  const trace = getCallTrace()
  return pipe(self, withPermitsScoped(1)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const withPermitsScoped = (permits: number) => {
  const trace = getCallTrace()
  return (self: TSemaphore.TSemaphore): Effect.Effect<Scope.Scope, never, void> =>
    Effect.acquireReleaseInterruptible(
      pipe(self, acquireN(permits), core.commit),
      () => pipe(self, releaseN(permits), core.commit)
    ).traced(trace)
}

/** @internal */
export const unsafeMakeSemaphore = (permits: number): TSemaphore.TSemaphore => {
  return new TSemaphoreImpl(new tRef.TRefImpl(permits))
}
