import * as Duration from "@effect/data/Duration"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as testContext from "@effect/io/internal/testing/testEnvironment"
import { makeFiberFailure } from "@effect/io/Runtime"
import * as Schedule from "@effect/io/Schedule"
import type * as Scope from "@effect/io/Scope"
import type { TestAPI } from "vitest"
import * as V from "vitest"

export type API = TestAPI<{}>

export const it: API = V.it

export const runTest = <E, A>(self: Effect.Effect<never, E, A>) =>
  Effect.runPromiseExit(self).then((exit) => {
    if (exit._tag === "Failure") {
      return Promise.reject(makeFiberFailure(exit.cause))
    }
    return Promise.resolve(exit.value)
  })

export const effect = (() => {
  const f = <E, A>(
    name: string,
    self: () => Effect.Effect<never, E, A>,
    timeout = 5_000
  ) => {
    return it(
      name,
      () =>
        pipe(
          Effect.suspend(self),
          Effect.provide(testContext.testContext()),
          runTest
        ),
      timeout
    )
  }
  return Object.assign(f, {
    skip: <E, A>(
      name: string,
      self: () => Effect.Effect<never, E, A>,
      timeout = 5_000
    ) => {
      return it.skip(
        name,
        () =>
          pipe(
            Effect.suspend(self),
            Effect.provide(testContext.testContext()),
            runTest
          ),
        timeout
      )
    },
    only: <E, A>(
      name: string,
      self: () => Effect.Effect<never, E, A>,
      timeout = 5_000
    ) => {
      return it.only(
        name,
        () =>
          pipe(
            Effect.suspend(self),
            Effect.provide(testContext.testContext()),
            runTest
          ),
        timeout
      )
    }
  })
})()

export const live = <E, A>(
  name: string,
  self: () => Effect.Effect<never, E, A>,
  timeout = 5_000
) => {
  return it(
    name,
    () =>
      pipe(
        Effect.suspend(self),
        runTest
      ),
    timeout
  )
}

export const flakyTest = <R, E, A>(
  self: Effect.Effect<R, E, A>,
  timeout: Duration.Duration = Duration.seconds(30)
) => {
  return pipe(
    Effect.catchAllDefect(self, Effect.fail),
    Effect.retry(
      pipe(
        Schedule.recurs(10),
        Schedule.compose(Schedule.elapsed),
        Schedule.whileOutput(Duration.lessThanOrEqualTo(timeout))
      )
    ),
    Effect.orDie
  )
}

export const scoped = <E, A>(
  name: string,
  self: () => Effect.Effect<Scope.Scope, E, A>,
  timeout = 5_000
) => {
  return it(
    name,
    () =>
      pipe(
        Effect.suspend(self),
        Effect.scoped,
        Effect.provide(testContext.testContext()),
        runTest
      ),
    timeout
  )
}

export const scopedLive = <E, A>(
  name: string,
  self: () => Effect.Effect<Scope.Scope, E, A>,
  timeout = 5_000
) => {
  return it(
    name,
    () =>
      pipe(
        Effect.suspend(self),
        Effect.scoped,
        runTest
      ),
    timeout
  )
}
