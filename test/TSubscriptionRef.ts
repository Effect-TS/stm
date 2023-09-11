import { pipe } from "@effect/data/Function"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as STM from "@effect/stm/STM"
import * as it from "@effect/stm/test/utils/extend"
import * as TSubscriptionRef from "@effect/stm/TSubscriptionRef"
import * as Stream from "@effect/stream/Stream"
import { assert, describe } from "vitest"

describe.concurrent("TSubscriptionRef", () => {
  it.effect("multiple subscribers can receive changes", () =>
    Effect.gen(function*($) {
      const subscriptionRef = yield* $(TSubscriptionRef.make(0))
      const deferred1 = yield* $(Deferred.make<never, void>())
      const deferred2 = yield* $(Deferred.make<never, void>())
      const subscriber1 = yield* $(pipe(
        subscriptionRef.changes,
        Stream.tap(() => Deferred.succeed<never, void>(deferred1, void 0)),
        Stream.take(3),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(Deferred.await(deferred1))
      yield* $(TSubscriptionRef.update(subscriptionRef, (n) => n + 1))
      const subscriber2 = yield* $(pipe(
        subscriptionRef.changes,
        Stream.tap(() => Deferred.succeed<never, void>(deferred2, void 0)),
        Stream.take(2),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(Deferred.await(deferred2))
      yield* $(TSubscriptionRef.update(subscriptionRef, (n) => n + 1))
      const result1 = yield* $(Fiber.join(subscriber1))
      const result2 = yield* $(Fiber.join(subscriber2))
      assert.deepStrictEqual(Array.from(result1), [0, 1, 2])
      assert.deepStrictEqual(Array.from(result2), [1, 2])
    }))

  it.effect("only emits comitted values", () =>
    Effect.gen(function*($) {
      const subscriptionRef = yield* $(TSubscriptionRef.make(0))

      const transaction = pipe(
        TSubscriptionRef.update(subscriptionRef, (n) => n + 1),
        STM.tap(() => TSubscriptionRef.update(subscriptionRef, (n) => n + 1))
      )

      const subscriber = yield* $(pipe(
        subscriptionRef.changes,
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      ))
      // stream doesn't work properly without a yield, it will drop values
      yield* $(Effect.yieldNow())
      yield* $(STM.commit(transaction))
      yield* $(Effect.yieldNow())
      const result = yield* $(Fiber.join(subscriber))

      assert.deepStrictEqual(Array.from(result), [2])
    }))

  it.effect("emits every comitted value", () =>
    Effect.gen(function*($) {
      const subscriptionRef = yield* $(TSubscriptionRef.make(0))

      const transaction = pipe(
        TSubscriptionRef.update(subscriptionRef, (n) => n + 1),
        STM.commit,
        // stream doesn't work properly without a yield, it will drop the first value without this
        Effect.tap(() => Effect.yieldNow()),
        Effect.flatMap(() => TSubscriptionRef.update(subscriptionRef, (n) => n + 1))
      )

      const subscriber = yield* $(pipe(
        subscriptionRef.changes,
        Stream.take(2),
        Stream.runCollect,
        Effect.fork
      ))
      // stream doesn't work properly without a yield, it will drop the first value without this
      yield* $(Effect.yieldNow())
      yield* $(transaction)
      const result = yield* $(Fiber.join(subscriber))

      assert.deepStrictEqual(Array.from(result), [1, 2])
    }))
})
