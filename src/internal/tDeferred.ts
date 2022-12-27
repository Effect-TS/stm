import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as stm from "@effect/stm/internal/stm"
import * as tRef from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TDeferred from "@effect/stm/TDeferred"
import type * as TRef from "@effect/stm/TRef"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const TDeferredSymbolKey = "@effect/stm/TDeferred"

/** @internal */
export const TDeferredTypeId: TDeferred.TDeferredTypeId = Symbol.for(
  TDeferredSymbolKey
) as TDeferred.TDeferredTypeId

/** @internal */
const tDeferredVariance = {
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
class TDeferredImpl<E, A> implements TDeferred.TDeferred<E, A> {
  readonly [TDeferredTypeId] = tDeferredVariance
  constructor(readonly ref: TRef.TRef<Option.Option<Either.Either<E, A>>>) {}
}

/**
 * @macro traced
 * @internal
 */
export const _await = <E, A>(self: TDeferred.TDeferred<E, A>): STM.STM<never, E, A> => {
  const trace = getCallTrace()
  return pipe(
    tRef.get(self.ref),
    stm.collect((option) =>
      Option.isSome(option) ?
        Option.some(stm.fromEither(option.value)) :
        Option.none
    ),
    stm.flatten
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const done = <E, A>(either: Either.Either<E, A>) => {
  const trace = getCallTrace()
  return (self: TDeferred.TDeferred<E, A>): STM.STM<never, never, boolean> =>
    pipe(
      tRef.get(self.ref),
      core.flatMap(Option.match(
        () =>
          pipe(
            self.ref,
            tRef.set(Option.some(either)),
            core.zipRight(core.succeed(true))
          ),
        () => core.succeed(false)
      ))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fail = <E>(error: E) => {
  const trace = getCallTrace()
  return <A>(self: TDeferred.TDeferred<E, A>): STM.STM<never, never, boolean> =>
    pipe(self, done<E, A>(Either.left(error))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const make = <E, A>(): STM.STM<never, never, TDeferred.TDeferred<E, A>> => {
  const trace = getCallTrace()
  return pipe(
    tRef.make<Option.Option<Either.Either<E, A>>>(Option.none),
    core.map((ref) => new TDeferredImpl(ref))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const poll = <E, A>(
  self: TDeferred.TDeferred<E, A>
): STM.STM<never, never, Option.Option<Either.Either<E, A>>> => {
  const trace = getCallTrace()
  return tRef.get(self.ref).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const succeed = <A>(value: A) => {
  const trace = getCallTrace()
  return <E>(self: TDeferred.TDeferred<E, A>): STM.STM<never, never, boolean> =>
    pipe(self, done<E, A>(Either.right(value))).traced(trace)
}
