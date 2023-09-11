import { dual, pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as STM from "@effect/stm/STM"
import * as THub from "@effect/stm/THub"
import * as TRef from "@effect/stm/TRef"
import type * as TSubscriptionRef from "@effect/stm/TSubscriptionRef"
import * as Stream from "@effect/stream/Stream"

/** @internal */
const TSubscriptionRefSymbolKey = "@effect/stm/TSubscriptionRef"

/** @internal */
export const TSubscriptionRefTypeId: TSubscriptionRef.TSubscriptionRefTypeId = Symbol.for(
  TSubscriptionRefSymbolKey
) as TSubscriptionRef.TSubscriptionRefTypeId

/** @internal */
const tSubscriptionRefVariance = {
  _A: (_: never) => _
}

/** @internal */
class TSubscriptionRefImpl<A> implements TSubscriptionRef.TSubscriptionRef<A> {
  readonly [TSubscriptionRefTypeId] = tSubscriptionRefVariance

  constructor(
    readonly ref: TRef.TRef<A>,
    readonly hub: THub.THub<A>
  ) {
  }

  get changes(): Stream.Stream<never, never, A> {
    return pipe(
      TRef.get(this.ref),
      Effect.flatMap((a) =>
        pipe(
          THub.subscribeScoped(this.hub),
          Effect.map((sub) => Stream.repeatEffect(sub.take)),
          Effect.map((s) =>
            pipe(
              Stream.make(a),
              Stream.concat(s)
            )
          )
        )
      ),
      Stream.unwrapScoped
    )
  }
}

/** @internal */
export const make = <A>(value: A): STM.STM<never, never, TSubscriptionRef.TSubscriptionRef<A>> => {
  const ref = TRef.make<A>(value)
  const hub = THub.unbounded<A>()
  return pipe(STM.all([ref, hub]), STM.map(([ref, hub]) => new TSubscriptionRefImpl(ref, hub)))
}

/** @internal */
export const get = <A>(self: TSubscriptionRef.TSubscriptionRef<A>) => TRef.get(self.ref)

/** @internal */
export const set = dual<
  <A>(value: A) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, void>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, value: A) => STM.STM<never, never, void>
>(
  2,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, value: A): STM.STM<never, never, void> =>
    STM.all([THub.publish(self.hub, value), TRef.set(self.ref, value)], { discard: true })
)

/** @internal */
export const getAndSet = dual<
  <A>(value: A) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, A>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, value: A) => STM.STM<never, never, A>
>(2, (self, value) =>
  STM.zipLeft(
    TRef.getAndSet(self.ref, value),
    THub.publish(self.hub, value)
  ))

/** @internal */
export const getAndUpdate = dual<
  <A>(f: (a: A) => A) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, A>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, f: (a: A) => A) => STM.STM<never, never, A>
>(2, (self, f) => TRef.getAndUpdate(self.ref, f).pipe(STM.tap((v) => THub.publish(self.hub, f(v)))))

/** @internal */
export const getAndUpdateSome = dual<
  <A>(f: (a: A) => Option.Option<A>) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, A>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, f: (a: A) => Option.Option<A>) => STM.STM<never, never, A>
>(
  2,
  (self, f) =>
    TRef.getAndUpdateSome(self.ref, f).pipe(
      STM.tap((v) =>
        Option.match(f(v), {
          onNone: () => STM.unit,
          onSome: (v) => THub.publish(self.hub, v).pipe(STM.asUnit)
        })
      )
    )
)

/** @internal */
export const setAndGet = dual<
  <A>(value: A) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, A>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, value: A) => STM.STM<never, never, A>
>(2, (self, value) => TRef.setAndGet(self.ref, value).pipe(STM.tap((v) => THub.publish(self.hub, v))))

/** @internal */
export const modify = dual<
  <A, B>(
    f: (a: A) => readonly [B, A]
  ) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, TSubscriptionRef.TSubscriptionRef<B>>,
  <A, B>(
    self: TSubscriptionRef.TSubscriptionRef<A>,
    f: (a: A) => readonly [B, A]
  ) => STM.STM<never, never, TSubscriptionRef.TSubscriptionRef<B>>
>(
  2,
  (self, f) => self.ref.modify(f).pipe(STM.flatMap(make))
)

/** @internal */
export const modifySome = dual<
  <A, B>(
    fallback: B,
    f: (a: A) => Option.Option<readonly [B, A]>
  ) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, TSubscriptionRef.TSubscriptionRef<B>>,
  <A, B>(
    self: TSubscriptionRef.TSubscriptionRef<A>,
    fallback: B,
    f: (a: A) => Option.Option<readonly [B, A]>
  ) => STM.STM<never, never, TSubscriptionRef.TSubscriptionRef<B>>
>(3, (self, fallback, f) => TRef.modifySome(self.ref, fallback, f).pipe(STM.flatMap(make)))

/** @internal */
export const update = dual<
  <A>(f: (a: A) => A) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, void>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, f: (a: A) => A) => STM.STM<never, never, void>
>(
  2,
  (self, f) =>
    TRef.updateAndGet(self.ref, f).pipe(
      STM.tap((v) => THub.publish(self.hub, v)),
      STM.asUnit
    )
)

/** @internal */
export const updateAndGet = dual<
  <A>(f: (a: A) => A) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, A>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, f: (a: A) => A) => STM.STM<never, never, A>
>(2, (self, f) =>
  TRef.updateAndGet(self.ref, f).pipe(
    STM.tap((v) => THub.publish(self.hub, v))
  ))

/** @internal */
export const updateSome = dual<
  <A>(f: (a: A) => Option.Option<A>) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, void>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, f: (a: A) => Option.Option<A>) => STM.STM<never, never, void>
>(
  2,
  (self, f) =>
    TRef.updateSomeAndGet(self.ref, f).pipe(
      STM.tap((v) => THub.publish(self.hub, v)),
      STM.asUnit
    )
)

/** @internal */
export const updateSomeAndGet = dual<
  <A>(f: (a: A) => Option.Option<A>) => (self: TSubscriptionRef.TSubscriptionRef<A>) => STM.STM<never, never, A>,
  <A>(self: TSubscriptionRef.TSubscriptionRef<A>, f: (a: A) => Option.Option<A>) => STM.STM<never, never, A>
>(
  2,
  (self, f) =>
    TRef.updateSomeAndGet(self.ref, f).pipe(
      STM.tap((v) => THub.publish(self.hub, v))
    )
)
