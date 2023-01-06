import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Schedule from "@effect/io/Schedule"
import * as STM from "@effect/stm/STM"
import * as TRef from "@effect/stm/TRef"
import * as Context from "@fp-ts/data/Context"
import * as Duration from "@fp-ts/data/Duration"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"

export class CircuitBreakerError {
  readonly _tag = "CircuitBreakerError"
}

/**
 * A CircuitBreaker maintains an internal state that can be:
 *
 * - open
 * - half-open
 * - closed
 *
 * When the state is open the wrapped effect is consider degraded and any execution instantly fails with
 * a CircuitBreakerError.
 *
 * When the state is half-open the wrapped effect is considered potentially degraded and any execution that
 * fails will trigger an open state, any successful execution will produce a closed state.
 *
 * When the state is closed the wrapped effect is considered healthy and requests are retried according to the
 * provided retry schedule. If the effect fails after the retry schedule completed the effect is considered
 * degraded and produces an open state.
 *
 * When an open state is detected the breaker will wait for the provided time before switching the
 * state to half-open.
 */
export interface CircuitBreaker<V extends string> {
  readonly _tag: "CircuitBreaker"
  readonly vendor: (_: never) => V
  readonly withBreaker: <R, E, A>(self: Effect.Effect<R, E, A>) => Effect.Effect<R, E | CircuitBreakerError, A>
}

export interface CircuitBreakerOptions {
  timeToSleep?: Duration.Duration
  schedule?: Schedule.Schedule<never, any, any>
}

export const makeBreaker = <V extends string>(opts?: CircuitBreakerOptions) =>
  Effect.gen(function*($) {
    const schedule = opts?.schedule ?? pipe(
      Schedule.exponential(Duration.millis(100), 1.5),
      Schedule.zipRight(Schedule.elapsed()),
      Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(10)))
    )

    const timeToSleep = opts?.timeToSleep ?? Duration.seconds(10)

    type State = "half-open" | "open" | "closed"

    const stateRef = yield* $(TRef.make<State>("closed"))

    const waitForOpen = STM.gen(function*($) {
      const state = yield* $(TRef.get(stateRef))

      if (state !== "open") {
        return yield* $(STM.retry())
      }

      return state
    })

    yield* $(Effect.forkScoped(Effect.gen(function*($) {
      while (true) {
        yield* $(waitForOpen)
        yield* $(Effect.sleep(timeToSleep))
        yield* $(pipe(stateRef, TRef.set("half-open")))
      }
    })))

    const breaker: CircuitBreaker<V> = {
      _tag: "CircuitBreaker",
      vendor: (_) => _,
      withBreaker: <R, E, A>(self: Effect.Effect<R, E, A>) =>
        Effect.gen(function*($) {
          const state = yield* $(TRef.get(stateRef))
          switch (state) {
            case "half-open": {
              const result = yield* $(pipe(self, Effect.either))
              if (Either.isLeft(result)) {
                yield* $(pipe(stateRef, TRef.update((_) => _ === "half-open" ? "open" : _)))
                return yield* $(Effect.fail(result.left))
              } else {
                yield* $(pipe(stateRef, TRef.update((_) => _ === "half-open" ? "closed" : _)))
                return result.right
              }
            }
            case "open": {
              return yield* $(Effect.fail(new CircuitBreakerError()))
            }
            case "closed": {
              const result = yield* $(pipe(
                self,
                Effect.retry<never, E, any>(schedule),
                Effect.either
              ))
              if (Either.isLeft(result)) {
                yield* $(pipe(stateRef, TRef.update((_) => _ === "closed" ? "open" : _)))
                return yield* $(Effect.fail(result.left))
              }
              return result.right
            }
          }
        })
    }

    return breaker
  })

export const CircuitBreakerLive = <V extends string>(
  vendor: Context.Tag<CircuitBreaker<V>>,
  opts?: CircuitBreakerOptions
) => Layer.scoped(vendor)(makeBreaker<V>(opts))

// usage

const CircuitBreakerA = Context.Tag<CircuitBreaker<"A">>()

export const program = Effect.gen(function*($) {
  const { withBreaker } = yield* $(Effect.service(CircuitBreakerA))

  yield* $(withBreaker(pipe(
    Effect.log("hello"),
    Effect.tap(() => Effect.sleep(Duration.millis(500))),
    Effect.tap(() => Effect.log("world"))
  )))
})

pipe(
  program,
  Effect.provideSomeLayer(CircuitBreakerLive(CircuitBreakerA)),
  Effect.unsafeFork
)
