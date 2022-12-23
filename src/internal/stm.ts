import * as Cause from "@effect/io/Cause"
import { getCallTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import type * as FiberId from "@effect/io/Fiber/Id"
import * as effectCore from "@effect/io/internal/core"
import * as core from "@effect/stm/internal/core"
import * as Journal from "@effect/stm/internal/stm/journal"
import * as STMState from "@effect/stm/internal/stm/stmState"
import type * as STM from "@effect/stm/STM"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Context from "@fp-ts/data/Context"
import * as Either from "@fp-ts/data/Either"
import type { LazyArg } from "@fp-ts/data/Function"
import { constFalse, constTrue, identity, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/**
 * @macro traced
 * @internal
 */
export const absolve = <R, E, E2, A>(self: STM.STM<R, E, Either.Either<E2, A>>): STM.STM<R, E | E2, A> => {
  const trace = getCallTrace()
  return pipe(self, core.flatMap(fromEither)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const acquireUseRelease = <R, E, A, R2, E2, A2, R3, E3, A3>(
  acquire: STM.STM<R, E, A>,
  use: (resource: A) => STM.STM<R2, E2, A2>,
  release: (resource: A) => STM.STM<R3, E3, A3>
): Effect.Effect<R | R2 | R3, E | E2 | E3, A2> => {
  const trace = getCallTrace()
  return Effect.uninterruptibleMask((restore) => {
    let state: STMState.STMState<E, A> = STMState.running
    return pipe(
      restore(
        core.unsafeAtomically(
          acquire,
          (exit) => {
            state = STMState.done(exit)
          },
          () => {
            state = STMState.interrupted
          }
        )
      ),
      Effect.foldCauseEffect(
        (cause) => {
          if (STMState.isDone(state) && Exit.isSuccess(state.exit)) {
            return pipe(
              release(state.exit.value),
              Effect.foldCauseEffect(
                (cause2) => Effect.failCause(Cause.parallel(cause, cause2)),
                () => Effect.failCause(cause)
              )
            )
          }
          return Effect.failCause(cause)
        },
        (a) =>
          pipe(
            restore(use(a)),
            Effect.foldCauseEffect(
              (cause) =>
                pipe(
                  release(a),
                  Effect.foldCauseEffect(
                    (cause2) => Effect.failCause(Cause.parallel(cause, cause2)),
                    () => Effect.failCause(cause)
                  )
                ),
              (a2) => pipe(release(a), Effect.as(a2))
            )
          )
      )
    )
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const as = <A2>(value: A2) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, A2> => pipe(self, core.map(() => value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const asSome = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, Option.Option<A>> => {
  const trace = getCallTrace()
  return pipe(self, core.map(Option.some)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const asSomeError = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, Option.Option<E>, A> => {
  const trace = getCallTrace()
  return pipe(self, mapError(Option.some)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const attempt = <A>(evaluate: LazyArg<A>): STM.STM<never, unknown, A> => {
  const trace = getCallTrace()
  return suspend(() => {
    try {
      return core.succeed(evaluate())
    } catch (defect) {
      return core.fail(defect)
    }
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const catchSome = <E, R2, E2, A2>(pf: (error: E) => Option.Option<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A | A2> =>
    pipe(
      self,
      core.catchAll((e): STM.STM<R | R2, E | E2, A | A2> =>
        pipe(
          pf(e),
          Option.getOrElse(() => core.fail(e))
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const check = (predicate: LazyArg<boolean>): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return suspend(() => predicate() ? unit() : core.retry()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const collect = <A, A2>(pf: (a: A) => Option.Option<A2>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A2> =>
    pipe(self, collectSTM((a) => pipe(pf(a), Option.map(core.succeed)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const collectAll = <R, E, A>(iterable: Iterable<STM.STM<R, E, A>>): STM.STM<R, E, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return pipe(iterable, forEach(identity)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const collectAllDiscard = <R, E, A>(iterable: Iterable<STM.STM<R, E, A>>): STM.STM<R, E, void> => {
  const trace = getCallTrace()
  return pipe(iterable, forEachDiscard(identity)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const collectFirst = <A, R, E, A2>(pf: (a: A) => STM.STM<R, E, Option.Option<A2>>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, Option.Option<A2>> =>
    pipe(
      core.sync(() => iterable[Symbol.iterator]()),
      core.flatMap((iterator) => {
        const loop: STM.STM<R, E, Option.Option<A2>> = suspend(() => {
          const next = iterator.next()
          if (next.done) {
            return succeedNone()
          }
          return pipe(
            pf(next.value),
            core.flatMap(Option.match(() => loop, succeedSome))
          )
        })
        return loop
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const collectSTM = <A, R2, E2, A2>(pf: (a: A) => Option.Option<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A2> =>
    pipe(
      self,
      core.foldSTM(core.fail, (a) => {
        const option = pf(a)
        return Option.isSome(option) ? option.value : core.retry()
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const commitEither = <R, E, A>(self: STM.STM<R, E, A>): Effect.Effect<R, E, A> => {
  const trace = getCallTrace()
  return Effect.absolve(core.commit(either(self))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const cond = <E, A>(
  predicate: LazyArg<boolean>,
  error: LazyArg<E>,
  result: LazyArg<A>
): STM.STM<never, E, A> => {
  const trace = getCallTrace()
  return suspend(() => predicate() ? core.succeed(result()) : core.fail(error())).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const either = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, Either.Either<E, A>> => {
  const trace = getCallTrace()
  return pipe(self, fold<E, Either.Either<E, A>, A, Either.Either<E, A>>(Either.left, Either.right)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const environment = <R>(): STM.STM<R, never, Context.Context<R>> => {
  const trace = getCallTrace()
  return core.effect<R, Context.Context<R>>((_, __, env) => env).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const environmentWith = <R0, R>(f: (environment: Context.Context<R0>) => R): STM.STM<R0, never, R> => {
  const trace = getCallTrace()
  return pipe(environment<R0>(), core.map(f)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const environmentWithSTM = <R0, R, E, A>(
  f: (environment: Context.Context<R0>) => STM.STM<R, E, A>
): STM.STM<R0 | R, E, A> => {
  const trace = getCallTrace()
  return pipe(environment<R0>(), core.flatMap(f)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const eventually = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, A> => {
  const trace = getCallTrace()
  return pipe(self, core.foldSTM(() => eventually(self), core.succeed)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const every = <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, boolean> =>
    pipe(
      core.sync(() => iterable[Symbol.iterator]()),
      core.flatMap((iterator) => {
        const loop: STM.STM<R, E, boolean> = suspend(() => {
          const next = iterator.next()
          if (next.done) {
            return core.succeed(true)
          }
          return pipe(
            predicate(next.value),
            core.flatMap((bool) => bool ? loop : core.succeed(bool))
          )
        })
        return loop
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const exists = <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, boolean> =>
    pipe(
      core.sync(() => iterable[Symbol.iterator]()),
      core.flatMap((iterator) => {
        const loop: STM.STM<R, E, boolean> = suspend(() => {
          const next = iterator.next()
          if (next.done) {
            return core.succeed(false)
          }
          return pipe(
            predicate(next.value),
            core.flatMap((bool) => bool ? core.succeed(bool) : loop)
          )
        })
        return loop
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fiberId = (): STM.STM<never, never, FiberId.FiberId> => {
  const trace = getCallTrace()
  return core.effect<never, FiberId.FiberId>((_, fiberId) => fiberId).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filter = <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, Chunk.Chunk<A>> =>
    pipe(
      Array.from(iterable).reduce(
        (acc, curr) =>
          pipe(
            acc,
            core.zipWith(predicate(curr), (as, p) => {
              if (p) {
                as.push(curr)
                return as
              }
              return as
            })
          ),
        core.succeed([]) as STM.STM<R, E, Array<A>>
      ),
      core.map(Chunk.unsafeFromArray)
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filterNot = <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, Chunk.Chunk<A>> =>
    pipe(iterable, filter((a) => negate(predicate(a)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filterOrDie = <A>(predicate: Predicate<A>, defect: LazyArg<unknown>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(self, filterOrElse(predicate, () => core.dieSync(defect))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filterOrDieMessage = <A>(predicate: Predicate<A>, message: string) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(self, filterOrElse(predicate, () => core.dieMessage(message))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filterOrElse = <A, R2, E2, A2>(predicate: Predicate<A>, orElse: LazyArg<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A | A2> =>
    pipe(self, filterOrElseWith(predicate, orElse)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filterOrElseWith = <A, R2, E2, A2>(predicate: Predicate<A>, orElse: (a: A) => STM.STM<R2, E2, A2>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A | A2> =>
    pipe(
      self,
      core.flatMap((a): STM.STM<R | R2, E | E2, A | A2> =>
        predicate(a) ?
          core.succeed(a) :
          orElse(a)
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const filterOrFail = <A, E2>(predicate: Predicate<A>, error: LazyArg<E2>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E | E2, A> =>
    pipe(self, filterOrElse(predicate, () => core.fail(error()))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const flatMapError = <E, R2, E2>(f: (error: E) => STM.STM<R2, never, E2>) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E2, A> =>
    pipe(self, core.foldSTM((e) => flip(f(e)), core.succeed)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const flatten = <R, E, R2, E2, A>(self: STM.STM<R, E, STM.STM<R2, E2, A>>): STM.STM<R | R2, E | E2, A> => {
  const trace = getCallTrace()
  return pipe(self, core.flatMap(identity)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const flattenErrorOption = <E2>(fallback: LazyArg<E2>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, Option.Option<E>, A>): STM.STM<R, E | E2, A> =>
    pipe(self, mapError(Option.getOrElse(fallback))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const flip = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, A, E> => {
  const trace = getCallTrace()
  return pipe(self, core.foldSTM(core.succeed, core.fail)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const flipWith = <R, A, E, R2, A2, E2>(f: (stm: STM.STM<R, A, E>) => STM.STM<R2, A2, E2>) => {
  const trace = getCallTrace()
  return (self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A | A2> => flip(f(flip(self))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fold = <E, A2, A, A3>(f: (error: E) => A2, g: (value: A) => A3) => {
  const trace = getCallTrace()
  return <R>(self: STM.STM<R, E, A>): STM.STM<R, never, A2 | A3> =>
    pipe(self, core.foldSTM((e) => core.succeed(f(e)), (a) => core.succeed(g(a)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const forEach = <A, R, E, A2>(f: (a: A) => STM.STM<R, E, A2>) => {
  const trace = getCallTrace()
  return (elements: Iterable<A>): STM.STM<R, E, Chunk.Chunk<A2>> =>
    pipe(
      Array.from(elements).reduce(
        (acc, curr) =>
          pipe(
            acc,
            core.zipWith(f(curr), (array, elem) => {
              array.push(elem)
              return array
            })
          ),
        core.succeed([]) as STM.STM<R, E, Array<A2>>
      ),
      core.map(Chunk.unsafeFromArray)
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const forEachDiscard = <A, R, E, _>(f: (a: A) => STM.STM<R, E, _>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, void> =>
    pipe(
      core.sync(() => iterable[Symbol.iterator]()),
      core.flatMap((iterator) => {
        const loop: STM.STM<R, E, void> = suspend(() => {
          const next = iterator.next()
          if (next.done) {
            return unit()
          }
          return pipe(f(next.value), core.flatMap(() => loop))
        })
        return loop
      })
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fromEither = <E, A>(either: Either.Either<E, A>): STM.STM<never, E, A> => {
  const trace = getCallTrace()
  switch (either._tag) {
    case "Left": {
      return core.fail(either.left).traced(trace)
    }
    case "Right": {
      return core.succeed(either.right).traced(trace)
    }
  }
}

/**
 * @macro traced
 * @internal
 */
export const fromOption = <A>(option: Option.Option<A>): STM.STM<never, Option.Option<never>, A> => {
  const trace = getCallTrace()
  return pipe(option, Option.match(() => core.fail(Option.none), core.succeed)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const head = <R, E, A>(self: STM.STM<R, E, Iterable<A>>): STM.STM<R, Option.Option<E>, A> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      (e) => core.fail(Option.some(e)),
      (a) =>
        pipe(
          Chunk.head(Chunk.fromIterable(a)),
          Option.match(
            () => core.fail(Option.none),
            core.succeed
          )
        )
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const ifSTM = <R1, R2, E1, E2, A, A1>(
  onTrue: STM.STM<R1, E1, A>,
  onFalse: STM.STM<R2, E2, A1>
) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, boolean>): STM.STM<R1 | R2 | R, E1 | E2 | E, A | A1> =>
    pipe(self, core.flatMap((bool): STM.STM<R1 | R2, E1 | E2, A | A1> => bool ? onTrue : onFalse)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const ignore = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, void> => {
  const trace = getCallTrace()
  return pipe(self, fold(unit, unit)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isFailure = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, boolean> => {
  const trace = getCallTrace()
  return pipe(self, fold(constTrue, constFalse)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isSuccess = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, boolean> => {
  const trace = getCallTrace()
  return pipe(self, fold(constFalse, constTrue)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const iterate = <Z>(initial: Z, cont: (z: Z) => boolean) => {
  const trace = getCallTrace()
  return <R, E>(body: (z: Z) => STM.STM<R, E, Z>): STM.STM<R, E, Z> => {
    if (cont(initial)) {
      return pipe(
        body(initial),
        core.flatMap((z) => iterate(z, cont)(body))
      ).traced(trace)
    }
    return core.succeed(initial).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const left = <R, E, A, A2>(self: STM.STM<R, E, Either.Either<A, A2>>): STM.STM<R, Either.Either<E, A2>, A> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      (e) => core.fail(Either.left(e)),
      Either.match(core.succeed, (a2) => core.fail(Either.right(a2)))
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const loop = <Z, R, E, A>(
  initial: Z,
  cont: (z: Z) => boolean,
  inc: (z: Z) => Z,
  body: (z: Z) => STM.STM<R, E, A>
): STM.STM<R, E, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  if (cont(initial)) {
    return pipe(
      body(initial),
      core.flatMap((a) => pipe(loop(inc(initial), cont, inc, body), core.map(Chunk.append(a))))
    ).traced(trace)
  }
  return core.succeed(Chunk.empty<A>()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const loopDiscard = <Z, R, E, X>(
  initial: Z,
  cont: (z: Z) => boolean,
  inc: (z: Z) => Z,
  body: (z: Z) => STM.STM<R, E, X>
): STM.STM<R, E, void> => {
  const trace = getCallTrace()
  if (cont(initial)) {
    return pipe(
      body(initial),
      core.flatMap(() => loopDiscard(inc(initial), cont, inc, body))
    ).traced(trace)
  }
  return unit().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const mapAttempt = <A, B>(f: (a: A) => B) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, unknown, B> =>
    pipe(self, core.foldSTM((e) => core.fail(e), (a) => attempt(() => f(a)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const mapBoth = <E, E2, A, A2>(f: (error: E) => E2, g: (value: A) => A2) => {
  const trace = getCallTrace()
  return <R>(self: STM.STM<R, E, A>): STM.STM<R, E2, A2> =>
    pipe(self, core.foldSTM((e) => core.fail(f(e)), (a) => core.succeed(g(a)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const mapError = <E, E2>(f: (error: E) => E2) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R, E2, A> =>
    pipe(self, core.foldSTM((e) => core.fail(f(e)), core.succeed)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const merge = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, E | A> => {
  const trace = getCallTrace()
  return pipe(self, core.foldSTM((e) => core.succeed(e), core.succeed)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const mergeAll = <A2, A>(
  zero: A2,
  f: (a2: A2, a: A) => A2
) => {
  const trace = getCallTrace()
  return <R, E>(iterable: Iterable<STM.STM<R, E, A>>): STM.STM<R, E, A2> =>
    Array.from(iterable).reduce(
      (acc, curr) => pipe(acc, core.zipWith(curr, f)),
      core.succeed(zero) as STM.STM<R, E, A2>
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const negate = <R, E>(self: STM.STM<R, E, boolean>): STM.STM<R, E, boolean> => {
  const trace = getCallTrace()
  return pipe(self, core.map((b) => !b)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const none = <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R, Option.Option<E>, void> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      (e) => core.fail(Option.some(e)),
      Option.match(unit, () => core.fail(Option.none))
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const option = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return pipe(self, fold(() => Option.none, Option.some)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orDie = <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, A> => {
  const trace = getCallTrace()
  return pipe(self, orDieWith(identity)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orDieWith = <E>(f: (error: E) => unknown) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R, never, A> =>
    pipe(self, mapError(f), core.catchAll(core.die)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orElse = <R2, E2, A2>(that: LazyArg<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E2, A | A2> =>
    pipe(
      core.effect<R, LazyArg<unknown>>((journal) => Journal.prepareResetJournal(journal)),
      core.flatMap((reset) =>
        pipe(
          self,
          core.orTry(() => pipe(core.sync(reset), core.flatMap(that))),
          core.catchAll(() => pipe(core.sync(reset), core.flatMap(that)))
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orElseEither = <R2, E2, A2>(that: LazyArg<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E2, Either.Either<A, A2>> =>
    pipe(self, core.map(Either.left), orElse(() => pipe(that(), core.map(Either.right)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orElseFail = <E2>(error: LazyArg<E2>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E2, A> =>
    pipe(self, orElse(() => core.failSync(error))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orElseOptional = <R2, E2, A2>(that: LazyArg<STM.STM<R2, Option.Option<E2>, A2>>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, Option.Option<E>, A>): STM.STM<R | R2, Option.Option<E | E2>, A | A2> =>
    pipe(self, core.catchAll(Option.match(that, (e) => core.fail(Option.some<E | E2>(e))))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const orElseSucceed = <A2>(value: LazyArg<A2>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, A | A2> =>
    pipe(self, orElse(() => core.sync(value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const provideEnvironment = <R>(env: Context.Context<R>) => {
  const trace = getCallTrace()
  return <E, A>(self: STM.STM<R, E, A>): STM.STM<never, E, A> =>
    pipe(self, core.provideSomeEnvironment<never, R>(() => env)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduce = <S, A, R, E>(zero: S, f: (s: S, a: A) => STM.STM<R, E, S>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, S> =>
    Array.from(iterable).reduce(
      (acc, curr) => pipe(acc, core.flatMap((s) => f(s, curr))),
      core.succeed(zero) as STM.STM<R, E, S>
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceAll = <R2, E2, A>(initial: STM.STM<R2, E2, A>, f: (x: A, y: A) => A) => {
  const trace = getCallTrace()
  return <R, E>(iterable: Iterable<STM.STM<R, E, A>>): STM.STM<R | R2, E | E2, A> =>
    Array.from(iterable).reduce(
      (acc, curr) => pipe(acc, core.zipWith(curr, f)),
      initial as STM.STM<R | R2, E | E2, A>
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceRight = <S, A, R, E>(zero: S, f: (s: S, a: A) => STM.STM<R, E, S>) => {
  const trace = getCallTrace()
  return (iterable: Iterable<A>): STM.STM<R, E, S> =>
    Array.from(iterable).reduceRight(
      (acc, curr) => pipe(acc, core.flatMap((s) => f(s, curr))),
      core.succeed(zero) as STM.STM<R, E, S>
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const refineOrDie = <E, E2>(pf: (error: E) => Option.Option<E2>) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R, E2, A> => pipe(self, refineOrDieWith(pf, identity)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const refineOrDieWith = <E, E2>(
  pf: (error: E) => Option.Option<E2>,
  f: (error: E) => unknown
) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R, E2, A> =>
    pipe(self, core.catchAll((e) => pipe(pf(e), Option.match(() => core.die(f(e)), core.fail)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reject = <A, E2>(pf: (a: A) => Option.Option<E2>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E | E2, A> =>
    pipe(self, rejectSTM((a) => pipe(pf(a), Option.map(core.fail)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const rejectSTM = <A, R2, E2>(pf: (a: A) => Option.Option<STM.STM<R2, E2, E2>>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A> =>
    pipe(
      self,
      core.flatMap((a) =>
        pipe(
          pf(a),
          Option.match(
            () => core.succeed(a),
            core.flatMap(core.fail)
          )
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const repeatUntil = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(
      self,
      core.flatMap((a) =>
        predicate(a) ?
          core.succeed(a) :
          pipe(self, repeatUntil(predicate))
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const repeatWhile = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(
      self,
      core.flatMap((a) =>
        predicate(a) ?
          pipe(self, repeatWhile(predicate)) :
          core.succeed(a)
      )
    ).traced(trace)
}

/** @internal */
export const replicate = (n: number) => {
  return <R, E, A>(self: STM.STM<R, E, A>): Chunk.Chunk<STM.STM<R, E, A>> =>
    Chunk.unsafeFromArray(Array.from({ length: n }, () => self))
}

/**
 * @macro traced
 * @internal
 */
export const replicateSTM = (n: number) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, Chunk.Chunk<A>> =>
    pipe(self, replicate(n), collectAll).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const replicateSTMDiscard = (n: number) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, void> =>
    pipe(self, replicate(n), collectAllDiscard).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retryUntil = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(self, collect((a) => predicate(a) ? Option.some(a) : Option.none)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const retryWhile = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(self, collect((a) => !predicate(a) ? Option.some(a) : Option.none)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const right = <R, E, A, A2>(self: STM.STM<R, E, Either.Either<A, A2>>): STM.STM<R, Either.Either<A, E>, A2> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      (e) => core.fail(Either.right(e)),
      Either.match((a) => core.fail(Either.left(a)), core.succeed)
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const partition = <R, E, A, A2>(f: (a: A) => STM.STM<R, E, A2>) => {
  const trace = getCallTrace()
  return (elements: Iterable<A>): STM.STM<R, never, readonly [Chunk.Chunk<E>, Chunk.Chunk<A2>]> =>
    pipe(
      elements,
      forEach((a) => either(f(a))),
      core.map((as) => effectCore.partitionMap(as, identity))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const service = <T>(tag: Context.Tag<T>): STM.STM<T, never, T> => {
  const trace = getCallTrace()
  return environmentWith<T, T>(Context.unsafeGet(tag)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const serviceWith = <T>(tag: Context.Tag<T>) => {
  const trace = getCallTrace()
  return <A>(f: (service: T) => A): STM.STM<T, never, A> => pipe(service(tag), core.map(f)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const serviceWithSTM = <T>(tag: Context.Tag<T>) => {
  const trace = getCallTrace()
  return <R, E, A>(f: (service: T) => STM.STM<R, E, A>): STM.STM<R | T, E, A> =>
    pipe(service(tag), core.flatMap(f)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const some = <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R, Option.Option<E>, A> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      (e) => core.fail(Option.some(e)),
      Option.match(() => core.fail(Option.none), core.succeed)
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const someOrElse = <A2>(orElse: LazyArg<A2>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R, E, A | A2> =>
    pipe(self, core.map(Option.getOrElse(orElse))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const someOrElseSTM = <R2, E2, A2>(orElse: LazyArg<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R | R2, E | E2, A | A2> =>
    pipe(self, core.flatMap(Option.match((): STM.STM<R | R2, E | E2, A | A2> => orElse(), core.succeed))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const someOrFail = <E2>(error: LazyArg<E2>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R, E | E2, A> =>
    pipe(self, core.flatMap(Option.match(() => core.failSync(error), core.succeed))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const someOrFailException = <R, E, A>(
  self: STM.STM<R, E, Option.Option<A>>
): STM.STM<R, E | Cause.NoSuchElementException, A> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      core.fail,
      Option.match(() => core.fail(Cause.NoSuchElementException()), core.succeed)
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const succeedLeft = <A>(value: A): STM.STM<never, never, Either.Either<A, never>> => {
  const trace = getCallTrace()
  return core.succeed(Either.left(value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const succeedNone = (): STM.STM<never, never, Option.Option<never>> => {
  const trace = getCallTrace()
  return core.succeed(Option.none).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const succeedRight = <A>(value: A): STM.STM<never, never, Either.Either<never, A>> => {
  const trace = getCallTrace()
  return core.succeed(Either.right(value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const succeedSome = <A>(value: A): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return core.succeed(Option.some(value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const summarized = <R2, E2, A2, A3>(
  summary: STM.STM<R2, E2, A2>,
  f: (before: A2, after: A2) => A3
) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, readonly [A3, A]> =>
    pipe(
      summary,
      core.flatMap((start) =>
        pipe(
          self,
          core.flatMap((value) =>
            pipe(
              summary,
              core.map((end) => [f(start, end), value] as const)
            )
          )
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const suspend = <R, E, A>(evaluate: LazyArg<STM.STM<R, E, A>>): STM.STM<R, E, A> => {
  const trace = getCallTrace()
  return flatten(core.sync(evaluate)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const tap = <A, R2, E2, _>(f: (a: A) => STM.STM<R2, E2, _>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A> =>
    pipe(self, core.flatMap((a) => pipe(f(a), as(a)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const tapBoth = <E, R2, E2, A2, A, R3, E3, A3>(
  f: (error: E) => STM.STM<R2, E2, A2>,
  g: (value: A) => STM.STM<R3, E3, A3>
) => {
  const trace = getCallTrace()
  return <R>(self: STM.STM<R, E, A>): STM.STM<R | R2 | R3, E | E2 | E3, A> =>
    pipe(
      self,
      core.foldSTM((e) => pipe(f(e), core.zipRight(core.fail(e))), (a) => pipe(g(a), as(a)))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const tapError = <E, R2, E2, _>(f: (error: E) => STM.STM<R2, E2, _>) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, A> =>
    pipe(self, core.foldSTM((e) => pipe(f(e), core.zipRight(core.fail(e))), core.succeed)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const tryCatch = <E, A>(
  attempt: () => A,
  onThrow: (u: unknown) => E
): Effect.Effect<never, E, A> => {
  const trace = getCallTrace()
  return suspend(() => {
    try {
      return core.succeed(attempt())
    } catch (error) {
      return core.fail(onThrow(error))
    }
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unit = (): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return core.succeed(void 0).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unleft = <R, E, A, A2>(self: STM.STM<R, Either.Either<E, A>, A2>): STM.STM<R, E, Either.Either<A2, A>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      Either.match(core.fail, (a) => core.succeed(Either.right(a))),
      (a) => core.succeed(Either.left(a))
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unless = (predicate: LazyArg<boolean>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, Option.Option<A>> =>
    suspend(() => predicate() ? succeedNone() : asSome(self)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unlessSTM = <R2, E2>(predicate: STM.STM<R2, E2, boolean>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, Option.Option<A>> =>
    pipe(predicate, core.flatMap((bool) => bool ? succeedNone() : asSome(self))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unright = <R, E, A, A2>(
  self: STM.STM<R, Either.Either<A, E>, A2>
): STM.STM<R, E, Either.Either<A, A2>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      Either.match((a) => core.succeed(Either.left(a)), core.fail),
      (a) => core.succeed(Either.right(a))
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unsome = <R, E, A>(self: STM.STM<R, Option.Option<E>, A>): STM.STM<R, E, Option.Option<A>> => {
  const trace = getCallTrace()
  return pipe(
    self,
    core.foldSTM(
      Option.match(() => core.succeed(Option.none), core.fail),
      (a) => core.succeed(Option.some(a))
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const validateAll = <R, E, A, B>(f: (a: A) => STM.STM<R, E, B>) => {
  const trace = getCallTrace()
  return (elements: Iterable<A>): STM.STM<R, Chunk.NonEmptyChunk<E>, Chunk.Chunk<B>> =>
    pipe(
      elements,
      partition(f),
      core.flatMap(([errors, values]) =>
        Chunk.isNonEmpty(errors) ?
          core.fail(errors) :
          core.succeed(values)
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const validateFirst = <R, E, A, B>(f: (a: A) => STM.STM<R, E, B>) => {
  const trace = getCallTrace()
  return (elements: Iterable<A>): STM.STM<R, Chunk.Chunk<E>, B> =>
    pipe(elements, forEach((a) => flip(f(a))), flip).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const when = (predicate: LazyArg<boolean>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, Option.Option<A>> =>
    suspend(() => predicate() ? asSome(self) : succeedNone()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const whenCase = <R, E, A, B>(
  evaluate: () => A,
  pf: (a: A) => Option.Option<STM.STM<R, E, B>>
): STM.STM<R, E, Option.Option<B>> => {
  const trace = getCallTrace()
  return suspend(() => pipe(pf(evaluate()), Option.map(asSome), Option.getOrElse(succeedNone))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const whenCaseSTM = <A, R2, E2, A2>(pf: (a: A) => Option.Option<STM.STM<R2, E2, A2>>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, Option.Option<A2>> =>
    pipe(self, core.flatMap((a) => whenCase(() => a, pf))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const whenSTM = <R2, E2>(predicate: STM.STM<R2, E2, boolean>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R2, E | E2, Option.Option<A>> =>
    pipe(predicate, core.flatMap((bool) => bool ? asSome(self) : succeedNone())).traced(trace)
}
