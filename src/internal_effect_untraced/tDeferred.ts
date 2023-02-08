import * as Debug from "@effect/io/Debug"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as stm from "@effect/stm/internal_effect_untraced/stm"
import * as tRef from "@effect/stm/internal_effect_untraced/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TDeferred from "@effect/stm/TDeferred"
import type * as TRef from "@effect/stm/TRef"
import * as Either from "@fp-ts/core/Either"
import * as Option from "@fp-ts/core/Option"

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

/** @internal */
export const _await = Debug.methodWithTrace((trace) =>
  <E, A>(self: TDeferred.TDeferred<E, A>): STM.STM<never, E, A> =>
    stm.flatten(
      stm.collect(tRef.get(self.ref), (option) =>
        Option.isSome(option) ?
          Option.some(stm.fromEither(option.value)) :
          Option.none())
    ).traced(trace)
)

/** @internal */
export const done = Debug.dualWithTrace<
  <E, A>(either: Either.Either<E, A>) => (self: TDeferred.TDeferred<E, A>) => STM.STM<never, never, boolean>,
  <E, A>(self: TDeferred.TDeferred<E, A>, either: Either.Either<E, A>) => STM.STM<never, never, boolean>
>(2, (trace) =>
  (self, either) =>
    core.flatMap(
      tRef.get(self.ref),
      Option.match(
        () =>
          core.zipRight(
            tRef.set(self.ref, Option.some(either)),
            core.succeed(true)
          ),
        () => core.succeed(false)
      )
    ).traced(trace))

/** @internal */
export const fail = Debug.dualWithTrace<
  <E>(error: E) => <A>(self: TDeferred.TDeferred<E, A>) => STM.STM<never, never, boolean>,
  <E, A>(self: TDeferred.TDeferred<E, A>, error: E) => STM.STM<never, never, boolean>
>(2, (trace) => (self, error) => done(self, Either.left(error)).traced(trace))

/** @internal */
export const make = Debug.methodWithTrace((trace) =>
  <E, A>(): STM.STM<never, never, TDeferred.TDeferred<E, A>> =>
    core.map(
      tRef.make<Option.Option<Either.Either<E, A>>>(Option.none()),
      (ref) => new TDeferredImpl(ref)
    ).traced(trace)
)

/** @internal */
export const poll = Debug.methodWithTrace((trace) =>
  <E, A>(self: TDeferred.TDeferred<E, A>): STM.STM<never, never, Option.Option<Either.Either<E, A>>> =>
    tRef.get(self.ref).traced(trace)
)

/** @internal */
export const succeed = Debug.dualWithTrace<
  <A>(value: A) => <E>(self: TDeferred.TDeferred<E, A>) => STM.STM<never, never, boolean>,
  <E, A>(self: TDeferred.TDeferred<E, A>, value: A) => STM.STM<never, never, boolean>
>(2, (trace) => (self, value) => done(self, Either.right(value)).traced(trace))
