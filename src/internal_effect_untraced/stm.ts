import * as Cause from "@effect/io/Cause"
import * as Debug from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import type * as FiberId from "@effect/io/Fiber/Id"
import * as effectCore from "@effect/io/internal_effect_untraced/core"
import * as SingleShotGen from "@effect/io/internal_effect_untraced/singleShotGen"
import type { EnforceNonEmptyRecord } from "@effect/io/internal_effect_untraced/types"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as Journal from "@effect/stm/internal_effect_untraced/stm/journal"
import * as STMState from "@effect/stm/internal_effect_untraced/stm/stmState"
import type { NonEmptyArraySTM, TupleSTM } from "@effect/stm/internal_effect_untraced/types"
import type * as STM from "@effect/stm/STM"
import * as Either from "@fp-ts/core/Either"
import type { LazyArg } from "@fp-ts/core/Function"
import { constFalse, constTrue, constVoid, identity, pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import type { Predicate } from "@fp-ts/core/Predicate"
import * as Chunk from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"

/**
 * @internal
 */
export const absolve = Debug.methodWithTrace((trace) =>
  <R, E, E2, A>(self: STM.STM<R, E, Either.Either<E2, A>>): STM.STM<R, E | E2, A> =>
    pipe(self, core.flatMap(fromEither)).traced(trace)
)

/**
 * @internal
 */
export const acquireUseRelease = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2, R3, E3, A3>(
    acquire: STM.STM<R, E, A>,
    use: (resource: A) => STM.STM<R2, E2, A2>,
    release: (resource: A) => STM.STM<R3, E3, A3>
  ) => Effect.Effect<R | R2 | R3, E | E2 | E3, A2>,
  <A, R2, E2, A2, R3, E3, A3>(
    use: (resource: A) => STM.STM<R2, E2, A2>,
    release: (resource: A) => STM.STM<R3, E3, A3>
  ) => <R, E>(acquire: STM.STM<R, E, A>) => Effect.Effect<R | R2 | R3, E | E2 | E3, A2>
>(3, (trace, restoreTrace) =>
  <R, E, A, R2, E2, A2, R3, E3, A3>(
    acquire: STM.STM<R, E, A>,
    use: (resource: A) => STM.STM<R2, E2, A2>,
    release: (resource: A) => STM.STM<R3, E3, A3>
  ): Effect.Effect<R | R2 | R3, E | E2 | E3, A2> =>
    Effect.uninterruptibleMask((restore) => {
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
        Effect.matchCauseEffect(
          (cause) => {
            if (STMState.isDone(state) && Exit.isSuccess(state.exit)) {
              return pipe(
                release(state.exit.value),
                Effect.matchCauseEffect(
                  (cause2) => Effect.failCause(Cause.parallel(cause, cause2)),
                  () => Effect.failCause(cause)
                )
              )
            }
            return Effect.failCause(cause)
          },
          (a) =>
            pipe(
              restore(restoreTrace(use)(a)),
              Effect.matchCauseEffect(
                (cause) =>
                  pipe(
                    restoreTrace(release)(a),
                    Effect.matchCauseEffect(
                      (cause2) => Effect.failCause(Cause.parallel(cause, cause2)),
                      () => Effect.failCause(cause)
                    )
                  ),
                (a2) => pipe(restoreTrace(release)(a), Effect.as(a2))
              )
            )
        )
      )
    }).traced(trace))

/**
 * @internal
 */
export const as = Debug.dualWithTrace<
  <R, E, A, A2>(self: STM.STM<R, E, A>, value: A2) => STM.STM<R, E, A2>,
  <A2>(value: A2) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, E, A2>
>(2, (trace) => (self, value) => pipe(self, core.map(() => value)).traced(trace))

/**
 * @internal
 */
export const asSome = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, Option.Option<A>> => pipe(self, core.map(Option.some)).traced(trace)
)

/**
 * @internal
 */
export const asSomeError = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, Option.Option<E>, A> => pipe(self, mapError(Option.some)).traced(trace)
)

/**
 * @internal
 */
export const asUnit = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, void> => pipe(self, core.map(constVoid)).traced(trace)
)

/**
 * @internal
 */
export const attempt = Debug.methodWithTrace((trace, restore) =>
  <A>(evaluate: LazyArg<A>): STM.STM<never, unknown, A> =>
    suspend(() => {
      try {
        return core.succeed(restore(evaluate)())
      } catch (defect) {
        return core.fail(defect)
      }
    }).traced(trace)
)

/**
 * @internal
 */
export const catchSome = Debug.dualWithTrace<
  <R, A, E, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    pf: (error: E) => Option.Option<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E | E2, A2 | A>,
  <E, R2, E2, A2>(
    pf: (error: E) => Option.Option<STM.STM<R2, E2, A2>>
  ) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E | E2, A2 | A>
>(2, (trace, restore) => (<R, A, E, R2, E2, A2>(
  self: STM.STM<R, E, A>,
  pf: (error: E) => Option.Option<STM.STM<R2, E2, A2>>
): STM.STM<R2 | R, E | E2, A2 | A> =>
  pipe(
    self,
    core.catchAll((e): STM.STM<R | R2, E | E2, A | A2> =>
      pipe(
        restore(pf)(e),
        Option.getOrElse(() => core.fail(e))
      )
    )
  ).traced(trace)))

/**
 * @internal
 */
export const check = Debug.methodWithTrace((trace, restore) =>
  (predicate: LazyArg<boolean>): STM.STM<never, never, void> =>
    suspend(() => restore(predicate)() ? unit() : core.retry()).traced(trace)
)

/**
 * @internal
 */
export const collect = Debug.dualWithTrace<
  <R, E, A, A2>(self: STM.STM<R, E, A>, pf: (a: A) => Option.Option<A2>) => STM.STM<R, E, A2>,
  <A, A2>(pf: (a: A) => Option.Option<A2>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A2>
>(
  2,
  (trace, restore) =>
    (self, pf) => pipe(self, collectSTM((a) => pipe(restore(pf)(a), Option.map(core.succeed)))).traced(trace)
)

/**
 * @internal
 */
export const collectAll = Debug.methodWithTrace((trace) =>
  <R, E, A>(iterable: Iterable<STM.STM<R, E, A>>): STM.STM<R, E, Chunk.Chunk<A>> =>
    pipe(iterable, forEach(identity)).traced(trace)
)

/**
 * @internal
 */
export const collectAllDiscard = Debug.methodWithTrace((trace) =>
  <R, E, A>(iterable: Iterable<STM.STM<R, E, A>>): STM.STM<R, E, void> =>
    pipe(iterable, forEachDiscard(identity)).traced(trace)
)

/**
 * @internal
 */
export const collectFirst = Debug.dualWithTrace<
  <A, R, E, A2>(
    iterable: Iterable<A>,
    pf: (a: A) => STM.STM<R, E, Option.Option<A2>>
  ) => STM.STM<R, E, Option.Option<A2>>,
  <A, R, E, A2>(
    pf: (a: A) => STM.STM<R, E, Option.Option<A2>>
  ) => (iterable: Iterable<A>) => STM.STM<R, E, Option.Option<A2>>
>(2, (trace, restore) =>
  <A, R, E, A2>(
    iterable: Iterable<A>,
    pf: (a: A) => STM.STM<R, E, Option.Option<A2>>
  ): STM.STM<R, E, Option.Option<A2>> =>
    pipe(
      core.sync(() => iterable[Symbol.iterator]()),
      core.flatMap((iterator) => {
        const loop: STM.STM<R, E, Option.Option<A2>> = suspend(() => {
          const next = iterator.next()
          if (next.done) {
            return succeedNone()
          }
          return pipe(
            restore(pf)(next.value),
            core.flatMap(Option.match(() => loop, succeedSome))
          )
        })
        return loop
      })
    ).traced(trace))

/**
 * @internal
 */
export const collectSTM = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    pf: (a: A) => Option.Option<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    pf: (a: A) => Option.Option<STM.STM<R2, E2, A2>>
  ) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, A2>
>(2, (trace, restore) =>
  (self, pf) =>
    core.matchSTM(self, core.fail, (a) => {
      const option = restore(pf)(a)
      return Option.isSome(option) ? option.value : core.retry()
    }).traced(trace))

/**
 * @internal
 */
export const commitEither = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): Effect.Effect<R, E, A> => Effect.absolve(core.commit(either(self))).traced(trace)
)

/**
 * @internal
 */
export const cond = Debug.methodWithTrace((trace, restore) =>
  <E, A>(
    predicate: LazyArg<boolean>,
    error: LazyArg<E>,
    result: LazyArg<A>
  ): STM.STM<never, E, A> => {
    return suspend(() => restore(predicate)() ? core.sync(restore(result)) : core.failSync(restore(error)))
      .traced(trace)
  }
)

/**
 * @internal
 */
export const either = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, Either.Either<E, A>> =>
    pipe(self, match<E, Either.Either<E, A>, A, Either.Either<E, A>>(Either.left, Either.right)).traced(trace)
)

/**
 * @internal
 */
export const context = Debug.methodWithTrace((trace) =>
  <R>(): STM.STM<R, never, Context.Context<R>> => core.effect<R, Context.Context<R>>((_, __, env) => env).traced(trace)
)

/**
 * @internal
 */
export const contextWith = Debug.methodWithTrace((trace, restore) =>
  <R0, R>(f: (environment: Context.Context<R0>) => R): STM.STM<R0, never, R> =>
    pipe(context<R0>(), core.map(restore(f))).traced(trace)
)

/**
 * @internal
 */
export const contextWithSTM = Debug.methodWithTrace((trace, restore) =>
  <R0, R, E, A>(
    f: (environment: Context.Context<R0>) => STM.STM<R, E, A>
  ): STM.STM<R0 | R, E, A> => pipe(context<R0>(), core.flatMap(restore(f))).traced(trace)
)

/**
 * @internal
 */
export const eventually = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, E, A> =>
    pipe(self, core.matchSTM(() => eventually(self), core.succeed)).traced(trace)
)

/**
 * @internal
 */
export const every = Debug.dualWithTrace<
  <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, boolean>,
  <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => (iterable: Iterable<A>) => STM.STM<R, E, boolean>
>(
  2,
  (trace, restore) =>
    <A, R, E>(
      iterable: Iterable<A>,
      predicate: (a: A) => STM.STM<R, E, boolean>
    ): STM.STM<R, E, boolean> =>
      pipe(
        core.flatMap(core.sync(() => iterable[Symbol.iterator]()), (iterator) => {
          const loop: STM.STM<R, E, boolean> = suspend(() => {
            const next = iterator.next()
            if (next.done) {
              return core.succeed(true)
            }
            return pipe(
              restore(predicate)(next.value),
              core.flatMap((bool) => bool ? loop : core.succeed(bool))
            )
          })
          return loop
        })
      ).traced(trace)
)

/**
 * @internal
 */
export const exists = Debug.dualWithTrace<
  <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, boolean>,
  <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => (iterable: Iterable<A>) => STM.STM<R, E, boolean>
>(
  2,
  (trace, restore) =>
    <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>): STM.STM<R, E, boolean> =>
      pipe(
        core.sync(() => iterable[Symbol.iterator]()),
        core.flatMap((iterator) => {
          const loop: STM.STM<R, E, boolean> = suspend(() => {
            const next = iterator.next()
            if (next.done) {
              return core.succeed(false)
            }
            return pipe(
              restore(predicate)(next.value),
              core.flatMap((bool) => bool ? core.succeed(bool) : loop)
            )
          })
          return loop
        })
      ).traced(trace)
)

/**
 * @internal
 */
export const fiberId = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, FiberId.FiberId> =>
    core.effect<never, FiberId.FiberId>((_, fiberId) => fiberId).traced(trace)
)

/**
 * @internal
 */
export const filter = Debug.dualWithTrace<
  <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, Chunk.Chunk<A>>,
  <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => (iterable: Iterable<A>) => STM.STM<R, E, Chunk.Chunk<A>>
>(
  2,
  (trace, restore) =>
    <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>): STM.STM<R, E, Chunk.Chunk<A>> =>
      pipe(
        Array.from(iterable).reduce(
          (acc, curr) =>
            pipe(
              acc,
              core.zipWith(restore(predicate)(curr), (as, p) => {
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
)

/**
 * @internal
 */
export const filterNot = Debug.dualWithTrace<
  <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, Chunk.Chunk<A>>,
  <A, R, E>(predicate: (a: A) => STM.STM<R, E, boolean>) => (iterable: Iterable<A>) => STM.STM<R, E, Chunk.Chunk<A>>
>(
  2,
  (trace, restore) =>
    <A, R, E>(iterable: Iterable<A>, predicate: (a: A) => STM.STM<R, E, boolean>): STM.STM<R, E, Chunk.Chunk<A>> =>
      pipe(iterable, filter((a) => negate(restore(predicate)(a)))).traced(trace)
)

/**
 * @internal
 */
export const filterOrDie = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>, defect: LazyArg<unknown>) => STM.STM<R, E, A>,
  <A>(predicate: Predicate<A>, defect: LazyArg<unknown>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A>
>(
  3,
  (trace, restore) =>
    <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>, defect: LazyArg<unknown>): STM.STM<R, E, A> =>
      pipe(self, filterOrElse(restore(predicate), () => core.dieSync(restore(defect)))).traced(trace)
)

/**
 * @internal
 */
export const filterOrDieMessage = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>, message: string) => STM.STM<R, E, A>,
  <A>(predicate: Predicate<A>, message: string) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A>
>(
  3,
  (trace, restore) =>
    (self, predicate, message) =>
      pipe(self, filterOrElse(restore(predicate), () => core.dieMessage(message))).traced(trace)
)

/**
 * @internal
 */
export const filterOrElse = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    predicate: Predicate<A>,
    orElse: LazyArg<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E2 | E, A | A2>,
  <A, R2, E2, A2>(
    predicate: Predicate<A>,
    orElse: LazyArg<STM.STM<R2, E2, A2>>
  ) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, A | A2>
>(
  3,
  (trace, restore) =>
    (self, predicate, orElse) => pipe(self, filterOrElseWith(restore(predicate), restore(orElse))).traced(trace)
)

/**
 * @internal
 */
export const filterOrElseWith = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    predicate: Predicate<A>,
    orElse: (a: A) => STM.STM<R2, E2, A2>
  ) => STM.STM<R2 | R, E2 | E, A | A2>,
  <A, R2, E2, A2>(
    predicate: Predicate<A>,
    orElse: (a: A) => STM.STM<R2, E2, A2>
  ) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, A | A2>
>(
  3,
  (trace, restore) =>
    <R, E, A, R2, E2, A2>(
      self: STM.STM<R, E, A>,
      predicate: Predicate<A>,
      orElse: (a: A) => STM.STM<R2, E2, A2>
    ): STM.STM<R2 | R, E2 | E, A | A2> =>
      core.flatMap(self, (a): STM.STM<R | R2, E | E2, A | A2> =>
        restore(predicate)(a) ?
          core.succeed(a) :
          restore(orElse)(a)).traced(trace)
)

/**
 * @internal
 */
export const filterOrFail = Debug.dualWithTrace<
  <R, E, A, E2>(self: STM.STM<R, E, A>, predicate: Predicate<A>, error: LazyArg<E2>) => STM.STM<R, E2 | E, A>,
  <A, E2>(predicate: Predicate<A>, error: LazyArg<E2>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E2 | E, A>
>(
  3,
  (trace, restore) =>
    (self, predicate, error) =>
      filterOrElse(self, restore(predicate), () => core.failSync(restore(error))).traced(trace)
)

/**
 * @internal
 */
export const flatMapError = Debug.dualWithTrace<
  <R, A, E, R2, E2>(self: STM.STM<R, E, A>, f: (error: E) => STM.STM<R2, never, E2>) => STM.STM<R2 | R, E2, A>,
  <E, R2, E2>(f: (error: E) => STM.STM<R2, never, E2>) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2, A>
>(
  2,
  (trace, restore) => (self, f) => core.matchSTM(self, (e) => flip(restore(f)(e)), core.succeed).traced(trace)
)

/**
 * @internal
 */
export const flatten = Debug.methodWithTrace((trace) =>
  <R, E, R2, E2, A>(self: STM.STM<R, E, STM.STM<R2, E2, A>>): STM.STM<R | R2, E | E2, A> =>
    core.flatMap(self, identity).traced(trace)
)

/**
 * @internal
 */
export const flattenErrorOption = Debug.dualWithTrace<
  <R, E, A, E2>(self: STM.STM<R, Option.Option<E>, A>, fallback: LazyArg<E2>) => STM.STM<R, E2 | E, A>,
  <E2>(fallback: LazyArg<E2>) => <R, E, A>(self: STM.STM<R, Option.Option<E>, A>) => STM.STM<R, E2 | E, A>
>(2, (trace, restore) => (self, fallback) => pipe(self, mapError(Option.getOrElse(restore(fallback)))).traced(trace))

/**
 * @internal
 */
export const flip = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, A, E> => core.matchSTM(self, core.succeed, core.fail).traced(trace)
)

/**
 * @internal
 */
export const flipWith = Debug.dualWithTrace<
  <R, A, E, R2, A2, E2>(
    self: STM.STM<R, E, A>,
    f: (stm: STM.STM<R, A, E>) => STM.STM<R2, A2, E2>
  ) => STM.STM<R | R2, E | E2, A | A2>,
  <R, A, E, R2, A2, E2>(
    f: (stm: STM.STM<R, A, E>) => STM.STM<R2, A2, E2>
  ) => (self: STM.STM<R, E, A>) => STM.STM<R | R2, E | E2, A | A2>
>(2, (trace, restore) => (self, f) => flip(restore(f)(flip(self))).traced(trace))

/**
 * @internal
 */
export const match = Debug.dualWithTrace<
  <R, E, A2, A, A3>(self: STM.STM<R, E, A>, f: (error: E) => A2, g: (value: A) => A3) => STM.STM<R, never, A2 | A3>,
  <E, A2, A, A3>(f: (error: E) => A2, g: (value: A) => A3) => <R>(self: STM.STM<R, E, A>) => STM.STM<R, never, A2 | A3>
>(
  3,
  (trace, restore) =>
    (self, f, g) =>
      core.matchSTM(self, (e) => core.succeed(restore(f)(e)), (a) => core.succeed(restore(g)(a))).traced(trace)
)

/**
 * @internal
 */
export const forEach = Debug.dualWithTrace<
  <A, R, E, A2>(elements: Iterable<A>, f: (a: A) => STM.STM<R, E, A2>) => STM.STM<R, E, Chunk.Chunk<A2>>,
  <A, R, E, A2>(f: (a: A) => STM.STM<R, E, A2>) => (elements: Iterable<A>) => STM.STM<R, E, Chunk.Chunk<A2>>
>(
  2,
  (trace, restore) =>
    <A, R, E, A2>(elements: Iterable<A>, f: (a: A) => STM.STM<R, E, A2>): STM.STM<R, E, Chunk.Chunk<A2>> =>
      core.map(
        suspend(() =>
          Array.from(elements).reduce(
            (acc, curr) =>
              pipe(
                acc,
                core.zipWith(restore(f)(curr), (array, elem) => {
                  array.push(elem)
                  return array
                })
              ),
            core.succeed([]) as STM.STM<R, E, Array<A2>>
          )
        ),
        Chunk.unsafeFromArray
      ).traced(trace)
)

/**
 * @internal
 */
export const forEachDiscard = Debug.dualWithTrace<
  <A, R, E, _>(iterable: Iterable<A>, f: (a: A) => STM.STM<R, E, _>) => STM.STM<R, E, void>,
  <A, R, E, _>(f: (a: A) => STM.STM<R, E, _>) => (iterable: Iterable<A>) => STM.STM<R, E, void>
>(
  2,
  (trace, restore) =>
    <A, R, E, _>(iterable: Iterable<A>, f: (a: A) => STM.STM<R, E, _>): STM.STM<R, E, void> =>
      pipe(
        core.sync(() => iterable[Symbol.iterator]()),
        core.flatMap((iterator) => {
          const loop: STM.STM<R, E, void> = suspend(() => {
            const next = iterator.next()
            if (next.done) {
              return unit()
            }
            return pipe(restore(f)(next.value), core.flatMap(() => loop))
          })
          return loop
        })
      ).traced(trace)
)

/**
 * @internal
 */
export const fromEither = Debug.methodWithTrace((trace) =>
  <E, A>(either: Either.Either<E, A>): STM.STM<never, E, A> => {
    switch (either._tag) {
      case "Left": {
        return core.fail(either.left).traced(trace)
      }
      case "Right": {
        return core.succeed(either.right).traced(trace)
      }
    }
  }
)

/**
 * @internal
 */
export const fromOption = Debug.methodWithTrace((trace) =>
  <A>(option: Option.Option<A>): STM.STM<never, Option.Option<never>, A> =>
    pipe(option, Option.match(() => core.fail(Option.none()), core.succeed)).traced(trace)
)

/**
 * @internal
 */
class STMGen {
  constructor(readonly value: STM.STM<any, any, any>) {}
  [Symbol.iterator]() {
    return new SingleShotGen.SingleShotGen(this)
  }
}

/**
 * Inspired by https://github.com/tusharmath/qio/pull/22 (revised)
 * @internal
 */
export const gen: typeof STM.gen = Debug.methodWithTrace((trace, restore) =>
  (f) =>
    suspend(() => {
      const iterator = f((self) => new STMGen(self) as any)
      const state = restore(() => iterator.next())()
      const run = (
        state: IteratorYieldResult<any> | IteratorReturnResult<any>
      ): STM.STM<any, any, any> =>
        state.done ?
          core.succeed(state.value) :
          core.flatMap(
            state.value.value as unknown as STM.STM<any, any, any>,
            (val: any) => run(restore(() => iterator.next(val))())
          )
      return run(state)
    }).traced(trace)
)

/**
 * @internal
 */
export const head = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, Iterable<A>>): STM.STM<R, Option.Option<E>, A> =>
    pipe(
      self,
      core.matchSTM(
        (e) => core.fail(Option.some(e)),
        (a) =>
          pipe(
            Chunk.head(Chunk.fromIterable(a)),
            Option.match(
              () => core.fail(Option.none()),
              core.succeed
            )
          )
      )
    ).traced(trace)
)

/**
 * @internal
 */
export const ifSTM = Debug.dualWithTrace<
  <R, E, R1, R2, E1, E2, A, A1>(
    self: STM.STM<R, E, boolean>,
    onTrue: STM.STM<R1, E1, A>,
    onFalse: STM.STM<R2, E2, A1>
  ) => STM.STM<R1 | R2 | R, E1 | E2 | E, A | A1>,
  <R1, R2, E1, E2, A, A1>(
    onTrue: STM.STM<R1, E1, A>,
    onFalse: STM.STM<R2, E2, A1>
  ) => <R, E>(self: STM.STM<R, E, boolean>) => STM.STM<R1 | R2 | R, E1 | E2 | E, A | A1>
>(
  3,
  (trace) =>
    <R, E, R1, R2, E1, E2, A, A1>(
      self: STM.STM<R, E, boolean>,
      onTrue: STM.STM<R1, E1, A>,
      onFalse: STM.STM<R2, E2, A1>
    ): STM.STM<R1 | R2 | R, E1 | E2 | E, A | A1> =>
      core.flatMap(self, (bool): STM.STM<R1 | R2, E1 | E2, A | A1> => bool ? onTrue : onFalse).traced(trace)
)

/**
 * @internal
 */
export const ignore = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, void> => match(self, unit, unit).traced(trace)
)

/**
 * @internal
 */
export const isFailure = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, boolean> => match(self, constTrue, constFalse).traced(trace)
)

/**
 * @internal
 */
export const isSuccess = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, boolean> => match(self, constFalse, constTrue).traced(trace)
)

/**
 * @internal
 */
export const iterate = Debug.methodWithTrace((trace, restore) =>
  <R, E, Z>(
    initial: Z,
    cont: (z: Z) => boolean,
    body: (z: Z) => STM.STM<R, E, Z>
  ): STM.STM<R, E, Z> => {
    return iterateLoop(initial, restore(cont), restore(body)).traced(trace)
  }
)

const iterateLoop = <R, E, Z>(
  initial: Z,
  cont: (z: Z) => boolean,
  body: (z: Z) => STM.STM<R, E, Z>
): STM.STM<R, E, Z> => {
  if (cont(initial)) {
    return pipe(
      body(initial),
      core.flatMap((z) => iterateLoop(z, cont, body))
    )
  }
  return core.succeed(initial)
}

/**
 * @internal
 */
export const left = Debug.methodWithTrace((trace) =>
  <R, E, A, A2>(self: STM.STM<R, E, Either.Either<A, A2>>): STM.STM<R, Either.Either<E, A2>, A> =>
    core.matchSTM(
      self,
      (e) => core.fail(Either.left(e)),
      Either.match(core.succeed, (a2) => core.fail(Either.right(a2)))
    ).traced(trace)
)

/**
 * @internal
 */
export const loop = Debug.methodWithTrace((trace, restore) =>
  <Z, R, E, A>(
    initial: Z,
    cont: (z: Z) => boolean,
    inc: (z: Z) => Z,
    body: (z: Z) => STM.STM<R, E, A>
  ): STM.STM<R, E, Chunk.Chunk<A>> => {
    return loopLoop(initial, restore(cont), restore(inc), restore(body)).traced(trace)
  }
)

const loopLoop = <Z, R, E, A>(
  initial: Z,
  cont: (z: Z) => boolean,
  inc: (z: Z) => Z,
  body: (z: Z) => STM.STM<R, E, A>
): STM.STM<R, E, Chunk.Chunk<A>> => {
  if (cont(initial)) {
    return pipe(
      body(initial),
      core.flatMap((a) => pipe(loopLoop(inc(initial), cont, inc, body), core.map(Chunk.append(a))))
    )
  }
  return core.succeed(Chunk.empty<A>())
}

/**
 * @internal
 */
export const loopDiscard = Debug.methodWithTrace((trace, restore) =>
  <Z, R, E, X>(
    initial: Z,
    cont: (z: Z) => boolean,
    inc: (z: Z) => Z,
    body: (z: Z) => STM.STM<R, E, X>
  ): STM.STM<R, E, void> => {
    return loopDiscardLoop(initial, restore(cont), restore(inc), restore(body))
  }
)

const loopDiscardLoop = <Z, R, E, X>(
  initial: Z,
  cont: (z: Z) => boolean,
  inc: (z: Z) => Z,
  body: (z: Z) => STM.STM<R, E, X>
): STM.STM<R, E, void> => {
  if (cont(initial)) {
    return pipe(
      body(initial),
      core.flatMap(() => loopDiscardLoop(inc(initial), cont, inc, body))
    )
  }
  return unit()
}

/**
 * @internal
 */
export const mapAttempt = Debug.dualWithTrace<
  <R, E, A, B>(self: STM.STM<R, E, A>, f: (a: A) => B) => STM.STM<R, unknown, B>,
  <A, B>(f: (a: A) => B) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, unknown, B>
>(
  2,
  (trace, restore) =>
    <R, E, A, B>(self: STM.STM<R, E, A>, f: (a: A) => B): STM.STM<R, unknown, B> =>
      core.matchSTM(self, (e) => core.fail(e), (a) => attempt(() => restore(f)(a))).traced(trace)
)

/**
 * @internal
 */
export const mapBoth = Debug.dualWithTrace<
  <R, E, E2, A, A2>(self: STM.STM<R, E, A>, f: (error: E) => E2, g: (value: A) => A2) => STM.STM<R, E2, A2>,
  <E, E2, A, A2>(f: (error: E) => E2, g: (value: A) => A2) => <R>(self: STM.STM<R, E, A>) => STM.STM<R, E2, A2>
>(
  3,
  (trace, restore) =>
    (self, f, g) =>
      core.matchSTM(self, (e) => core.fail(restore(f)(e)), (a) => core.succeed(restore(g)(a))).traced(trace)
)

/**
 * @internal
 */
export const mapError = Debug.dualWithTrace<
  <R, A, E, E2>(self: STM.STM<R, E, A>, f: (error: E) => E2) => STM.STM<R, E2, A>,
  <E, E2>(f: (error: E) => E2) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R, E2, A>
>(2, (trace, restore) => (self, f) => core.matchSTM(self, (e) => core.fail(restore(f)(e)), core.succeed).traced(trace))

/**
 * @internal
 */
export const merge = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, E | A> =>
    core.matchSTM(self, (e) => core.succeed(e), core.succeed).traced(trace)
)

/**
 * @internal
 */
export const mergeAll = Debug.dualWithTrace<
  <R, E, A2, A>(iterable: Iterable<STM.STM<R, E, A>>, zero: A2, f: (a2: A2, a: A) => A2) => STM.STM<R, E, A2>,
  <A2, A>(zero: A2, f: (a2: A2, a: A) => A2) => <R, E>(iterable: Iterable<STM.STM<R, E, A>>) => STM.STM<R, E, A2>
>(
  3,
  (trace, restore) =>
    <R, E, A2, A>(iterable: Iterable<STM.STM<R, E, A>>, zero: A2, f: (a2: A2, a: A) => A2): STM.STM<R, E, A2> =>
      suspend(() =>
        Array.from(iterable).reduce(
          (acc, curr) => pipe(acc, core.zipWith(curr, restore(f))),
          core.succeed(zero) as STM.STM<R, E, A2>
        )
      ).traced(trace)
)

/**
 * @internal
 */
export const negate = Debug.methodWithTrace((trace) =>
  <R, E>(self: STM.STM<R, E, boolean>): STM.STM<R, E, boolean> => pipe(self, core.map((b) => !b)).traced(trace)
)

/**
 * @internal
 */
export const none = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R, Option.Option<E>, void> =>
    core.matchSTM(
      self,
      (e) => core.fail(Option.some(e)),
      Option.match(unit, () => core.fail(Option.none()))
    ).traced(trace)
)

/**
 * @internal
 */
export const option = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, Option.Option<A>> =>
    match(self, () => Option.none(), Option.some).traced(trace)
)

/**
 * @internal
 */
export const orDie = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R, never, A> => pipe(self, orDieWith(identity)).traced(trace)
)

/**
 * @internal
 */
export const orDieWith = Debug.dualWithTrace<
  <R, A, E>(self: STM.STM<R, E, A>, f: (error: E) => unknown) => STM.STM<R, never, A>,
  <E>(f: (error: E) => unknown) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R, never, A>
>(2, (trace, restore) => (self, f) => pipe(self, mapError(restore(f)), core.catchAll(core.die)).traced(trace))

/**
 * @internal
 */
export const orElse = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(self: STM.STM<R, E, A>, that: LazyArg<STM.STM<R2, E2, A2>>) => STM.STM<R2 | R, E2, A2 | A>,
  <R2, E2, A2>(that: LazyArg<STM.STM<R2, E2, A2>>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2, A2 | A>
>(
  2,
  (trace, restore) =>
    <R, E, A, R2, E2, A2>(self: STM.STM<R, E, A>, that: LazyArg<STM.STM<R2, E2, A2>>): STM.STM<R2 | R, E2, A2 | A> =>
      core.flatMap(core.effect<R, LazyArg<void>>((journal) => Journal.prepareResetJournal(journal)), (reset) =>
        pipe(
          self,
          core.orTry(() => pipe(core.sync(reset), core.flatMap(restore(that)))),
          core.catchAll(() => pipe(core.sync(reset), core.flatMap(restore(that))))
        )).traced(trace)
)

/**
 * @internal
 */
export const orElseEither = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    that: LazyArg<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E2, Either.Either<A, A2>>,
  <R2, E2, A2>(
    that: LazyArg<STM.STM<R2, E2, A2>>
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2, Either.Either<A, A2>>
>(
  2,
  (trace, restore) =>
    <R, E, A, R2, E2, A2>(
      self: STM.STM<R, E, A>,
      that: LazyArg<STM.STM<R2, E2, A2>>
    ): STM.STM<R2 | R, E2, Either.Either<A, A2>> =>
      orElse(core.map(self, Either.left), () => core.map(restore(that)(), Either.right)).traced(trace)
)

/**
 * @internal
 */
export const orElseFail = Debug.dualWithTrace<
  <R, E, A, E2>(self: STM.STM<R, E, A>, error: LazyArg<E2>) => STM.STM<R, E2, A>,
  <E2>(error: LazyArg<E2>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, E2, A>
>(
  2,
  (trace, restore) =>
    <R, E, A, E2>(self: STM.STM<R, E, A>, error: LazyArg<E2>): STM.STM<R, E2, A> =>
      orElse(self, () => core.failSync(restore(error))).traced(trace)
)

/**
 * @internal
 */
export const orElseOptional = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, Option.Option<E>, A>,
    that: LazyArg<STM.STM<R2, Option.Option<E2>, A2>>
  ) => STM.STM<R2 | R, Option.Option<E2 | E>, A2 | A>,
  <R2, E2, A2>(
    that: LazyArg<STM.STM<R2, Option.Option<E2>, A2>>
  ) => <R, E, A>(self: STM.STM<R, Option.Option<E>, A>) => STM.STM<R2 | R, Option.Option<E2 | E>, A2 | A>
>(
  2,
  (trace, restore) =>
    <R, E, A, R2, E2, A2>(
      self: STM.STM<R, Option.Option<E>, A>,
      that: LazyArg<STM.STM<R2, Option.Option<E2>, A2>>
    ): STM.STM<R2 | R, Option.Option<E2 | E>, A2 | A> =>
      core.catchAll(self, Option.match(restore(that), (e) => core.fail(Option.some<E | E2>(e)))).traced(trace)
)

/**
 * @internal
 */
export const orElseSucceed = Debug.dualWithTrace<
  <R, E, A, A2>(self: STM.STM<R, E, A>, value: LazyArg<A2>) => STM.STM<R, never, A2 | A>,
  <A2>(value: LazyArg<A2>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, never, A2 | A>
>(
  2,
  (trace, restore) =>
    <R, E, A, A2>(self: STM.STM<R, E, A>, value: LazyArg<A2>): STM.STM<R, never, A2 | A> =>
      orElse(self, () => core.sync(restore(value))).traced(trace)
)

/**
 * @internal
 */
export const provideContext = Debug.dualWithTrace<
  <E, A, R>(self: STM.STM<R, E, A>, env: Context.Context<R>) => STM.STM<never, E, A>,
  <R>(env: Context.Context<R>) => <E, A>(self: STM.STM<R, E, A>) => STM.STM<never, E, A>
>(2, (trace) => (self, env) => core.contramapContext(self, (_: Context.Context<never>) => env).traced(trace))

/**
 * @internal
 */
export const provideService = Debug.dualWithTrace<
  <R, E, A, T extends Context.Tag<any>>(
    self: STM.STM<R, E, A>,
    tag: T,
    resource: Context.Tag.Service<T>
  ) => STM.STM<Exclude<R, Context.Tag.Service<T>>, E, A>,
  <T extends Context.Tag<any>>(
    tag: T,
    resource: Context.Tag.Service<T>
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<Exclude<R, Context.Tag.Service<T>>, E, A>
>(3, (trace) => (self, tag, resource) => provideServiceSTM(self, tag, core.succeed(resource)).traced(trace))

/**
 * @internal
 */
export const provideServiceSTM = Debug.dualWithTrace<
  <R, E, A, T extends Context.Tag<T>, R1, E1>(
    self: STM.STM<R, E, A>,
    tag: T,
    stm: STM.STM<R1, E1, Context.Tag.Service<T>>
  ) => STM.STM<R1 | Exclude<R, Context.Tag.Service<T>>, E1 | E, A>,
  <T extends Context.Tag<T>, R1, E1>(
    tag: Context.Tag<T>,
    stm: STM.STM<R1, E1, Context.Tag.Service<T>>
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | Exclude<R, Context.Tag.Service<T>>, E1 | E, A>
>(3, (trace) =>
  <R, E, A, T extends Context.Tag<T>, R1, E1>(
    self: STM.STM<R, E, A>,
    tag: T,
    stm: STM.STM<R1, E1, Context.Tag.Service<T>>
  ): STM.STM<R1 | Exclude<R, Context.Tag.Service<T>>, E1 | E, A> =>
    contextWithSTM((env: Context.Context<R1 | Exclude<R, Context.Tag.Service<T>>>) =>
      core.flatMap(
        stm,
        (service) =>
          provideContext(
            self,
            Context.add(env, tag, service) as Context.Context<R | R1>
          )
      )
    ).traced(trace))

/**
 * @internal
 */
export const reduce = Debug.dualWithTrace<
  <S, A, R, E>(iterable: Iterable<A>, zero: S, f: (s: S, a: A) => STM.STM<R, E, S>) => STM.STM<R, E, S>,
  <S, A, R, E>(zero: S, f: (s: S, a: A) => STM.STM<R, E, S>) => (iterable: Iterable<A>) => STM.STM<R, E, S>
>(
  3,
  (trace, restore) =>
    <S, A, R, E>(iterable: Iterable<A>, zero: S, f: (s: S, a: A) => STM.STM<R, E, S>): STM.STM<R, E, S> =>
      suspend(() =>
        Array.from(iterable).reduce(
          (acc, curr) => pipe(acc, core.flatMap((s) => restore(f)(s, curr))),
          core.succeed(zero) as STM.STM<R, E, S>
        ).traced(trace)
      )
)

/**
 * @internal
 */
export const reduceAll = Debug.dualWithTrace<
  <R, E, R2, E2, A>(
    iterable: Iterable<STM.STM<R, E, A>>,
    initial: STM.STM<R2, E2, A>,
    f: (x: A, y: A) => A
  ) => STM.STM<R2 | R, E2 | E, A>,
  <R2, E2, A>(
    initial: STM.STM<R2, E2, A>,
    f: (x: A, y: A) => A
  ) => <R, E>(iterable: Iterable<STM.STM<R, E, A>>) => STM.STM<R2 | R, E2 | E, A>
>(3, (trace, restore) =>
  <R, E, R2, E2, A>(
    iterable: Iterable<STM.STM<R, E, A>>,
    initial: STM.STM<R2, E2, A>,
    f: (x: A, y: A) => A
  ): STM.STM<R2 | R, E2 | E, A> =>
    suspend(() =>
      Array.from(iterable).reduce(
        (acc, curr) => pipe(acc, core.zipWith(curr, restore(f))),
        initial as STM.STM<R | R2, E | E2, A>
      ).traced(trace)
    ))

/**
 * @internal
 */
export const reduceRight = Debug.dualWithTrace<
  <S, A, R, E>(iterable: Iterable<A>, zero: S, f: (s: S, a: A) => STM.STM<R, E, S>) => STM.STM<R, E, S>,
  <S, A, R, E>(zero: S, f: (s: S, a: A) => STM.STM<R, E, S>) => (iterable: Iterable<A>) => STM.STM<R, E, S>
>(
  3,
  (trace, restore) =>
    <S, A, R, E>(iterable: Iterable<A>, zero: S, f: (s: S, a: A) => STM.STM<R, E, S>): STM.STM<R, E, S> =>
      suspend(() =>
        Array.from(iterable).reduceRight(
          (acc, curr) => pipe(acc, core.flatMap((s) => restore(f)(s, curr))),
          core.succeed(zero) as STM.STM<R, E, S>
        ).traced(trace)
      )
)

/**
 * @internal
 */
export const refineOrDie = Debug.dualWithTrace<
  <R, A, E, E2>(self: STM.STM<R, E, A>, pf: (error: E) => Option.Option<E2>) => STM.STM<R, E2, A>,
  <E, E2>(pf: (error: E) => Option.Option<E2>) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R, E2, A>
>(2, (trace, restore) => (self, pf) => pipe(self, refineOrDieWith(restore(pf), identity)).traced(trace))

/**
 * @internal
 */
export const refineOrDieWith = Debug.dualWithTrace<
  <R, A, E, E2>(
    self: STM.STM<R, E, A>,
    pf: (error: E) => Option.Option<E2>,
    f: (error: E) => unknown
  ) => STM.STM<R, E2, A>,
  <E, E2>(
    pf: (error: E) => Option.Option<E2>,
    f: (error: E) => unknown
  ) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R, E2, A>
>(
  3,
  (trace, restore) =>
    (self, pf, f) =>
      pipe(self, core.catchAll((e) => pipe(restore(pf)(e), Option.match(() => core.die(restore(f)(e)), core.fail))))
        .traced(trace)
)

/**
 * @internal
 */
export const reject = Debug.dualWithTrace<
  <R, E, A, E2>(self: STM.STM<R, E, A>, pf: (a: A) => Option.Option<E2>) => STM.STM<R, E2 | E, A>,
  <A, E2>(pf: (a: A) => Option.Option<E2>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E2 | E, A>
>(
  2,
  (trace, restore) =>
    (self, pf) => pipe(self, rejectSTM((a) => pipe(restore(pf)(a), Option.map(core.fail)))).traced(trace)
)

/**
 * @internal
 */
export const rejectSTM = Debug.dualWithTrace<
  <R, E, A, R2, E2>(
    self: STM.STM<R, E, A>,
    pf: (a: A) => Option.Option<STM.STM<R2, E2, E2>>
  ) => STM.STM<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    pf: (a: A) => Option.Option<STM.STM<R2, E2, E2>>
  ) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, A>
>(2, (trace, restore) =>
  (self, pf) =>
    core.flatMap(self, (a) =>
      pipe(
        restore(pf)(a),
        Option.match(
          () => core.succeed(a),
          core.flatMap(core.fail)
        )
      )).traced(trace))

/**
 * @internal
 */
export const repeatUntil = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>) => STM.STM<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A>
>(2, (trace, restore) => (self, predicate) => repeatUntilLoop(self, restore(predicate)).traced(trace))

const repeatUntilLoop = <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>): STM.STM<R, E, A> =>
  pipe(
    core.flatMap(self, (a) =>
      predicate(a) ?
        core.succeed(a) :
        repeatUntilLoop(self, predicate))
  )

/**
 * @internal
 */
export const repeatWhile = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>) => STM.STM<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A>
>(2, (trace, restore) => (self, predicate) => repeatWhileLoop(self, restore(predicate)).traced(trace))

const repeatWhileLoop = <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>): STM.STM<R, E, A> =>
  pipe(
    core.flatMap(self, (a) =>
      predicate(a) ?
        repeatWhileLoop(self, predicate) :
        core.succeed(a))
  )

/** @internal */
export const replicate = Debug.dual<
  <R, E, A>(self: STM.STM<R, E, A>, n: number) => Chunk.Chunk<STM.STM<R, E, A>>,
  (n: number) => <R, E, A>(self: STM.STM<R, E, A>) => Chunk.Chunk<STM.STM<R, E, A>>
>(2, (self, n) => Chunk.unsafeFromArray(Array.from({ length: n }, () => self)))

/**
 * @internal
 */
export const replicateSTM = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, n: number) => STM.STM<R, E, Chunk.Chunk<A>>,
  (n: number) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, E, Chunk.Chunk<A>>
>(2, (trace) => (self, n) => pipe(self, replicate(n), collectAll).traced(trace))

/**
 * @internal
 */
export const replicateSTMDiscard = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, n: number) => STM.STM<R, E, void>,
  (n: number) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, E, void>
>(2, (trace) => (self, n) => pipe(self, replicate(n), collectAllDiscard).traced(trace))

/**
 * @internal
 */
export const retryUntil = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>) => STM.STM<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A>
>(
  2,
  (trace, restore) =>
    (self, predicate) =>
      pipe(self, collect((a) => restore(predicate)(a) ? Option.some(a) : Option.none())).traced(trace)
)

/**
 * @internal
 */
export const retryWhile = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: Predicate<A>) => STM.STM<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, A>
>(
  2,
  (trace, restore) =>
    (self, predicate) =>
      pipe(self, collect((a) => !restore(predicate)(a) ? Option.some(a) : Option.none())).traced(trace)
)

/**
 * @internal
 */
export const right = Debug.methodWithTrace((trace) =>
  <R, E, A, A2>(self: STM.STM<R, E, Either.Either<A, A2>>): STM.STM<R, Either.Either<A, E>, A2> =>
    core.matchSTM(
      self,
      (e) => core.fail(Either.right(e)),
      Either.match((a) => core.fail(Either.left(a)), core.succeed)
    ).traced(trace)
)

/**
 * @internal
 */
export const partition = Debug.dualWithTrace<
  <R, E, A, A2>(
    elements: Iterable<A>,
    f: (a: A) => STM.STM<R, E, A2>
  ) => STM.STM<R, never, readonly [Chunk.Chunk<E>, Chunk.Chunk<A2>]>,
  <R, E, A, A2>(
    f: (a: A) => STM.STM<R, E, A2>
  ) => (elements: Iterable<A>) => STM.STM<R, never, readonly [Chunk.Chunk<E>, Chunk.Chunk<A2>]>
>(2, (trace, restore) =>
  (elements, f) =>
    pipe(
      elements,
      forEach((a) => either(restore(f)(a))),
      core.map((as) => effectCore.partitionMap(as, identity))
    ).traced(trace))

/**
 * @internal
 */
export const service = Debug.methodWithTrace((trace) =>
  <T>(tag: Context.Tag<T>): STM.STM<T, never, T> => contextWith<T, T>(Context.unsafeGet(tag)).traced(trace)
)

/**
 * @internal
 */
export const serviceWith = Debug.methodWithTrace((trace) =>
  <T, A>(tag: Context.Tag<T>, f: (service: T) => A): STM.STM<T, never, A> =>
    pipe(service(tag), core.map(f)).traced(trace)
)

/**
 * @internal
 */
export const serviceWithSTM = Debug.methodWithTrace((trace) =>
  <T, R, E, A>(tag: Context.Tag<T>, f: (service: T) => STM.STM<R, E, A>): STM.STM<R | T, E, A> =>
    pipe(service(tag), core.flatMap(f)).traced(trace)
)

/**
 * @internal
 */
export const some = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, Option.Option<A>>): STM.STM<R, Option.Option<E>, A> =>
    core.matchSTM(
      self,
      (e) => core.fail(Option.some(e)),
      Option.match(() => core.fail(Option.none()), core.succeed)
    ).traced(trace)
)

/**
 * @internal
 */
export const someOrElse = Debug.dualWithTrace<
  <R, E, A, A2>(self: STM.STM<R, E, Option.Option<A>>, orElse: LazyArg<A2>) => STM.STM<R, E, A2 | A>,
  <A2>(orElse: LazyArg<A2>) => <R, E, A>(self: STM.STM<R, E, Option.Option<A>>) => STM.STM<R, E, A2 | A>
>(2, (trace, restore) => (self, orElse) => pipe(self, core.map(Option.getOrElse(restore(orElse)))).traced(trace))

Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, Option.Option<A>>,
    orElse: LazyArg<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    orElse: LazyArg<STM.STM<R2, E2, A2>>
  ) => <R, E, A>(self: STM.STM<R, E, Option.Option<A>>) => STM.STM<R2 | R, E2 | E, A2 | A>
>(
  2,
  (trace, restore) =>
    <R, E, A, R2, E2, A2>(
      self: STM.STM<R, E, Option.Option<A>>,
      orElse: LazyArg<STM.STM<R2, E2, A2>>
    ): STM.STM<R2 | R, E2 | E, A2 | A> =>
      core.flatMap(
        self,
        Option.match((): STM.STM<R | R2, E | E2, A | A2> => restore(orElse)(), core.succeed)
      ).traced(trace)
)

/**
 * @internal
 */
export const someOrElseSTM = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, Option.Option<A>>,
    orElse: LazyArg<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    orElse: LazyArg<STM.STM<R2, E2, A2>>
  ) => <R, E, A>(self: STM.STM<R, E, Option.Option<A>>) => STM.STM<R2 | R, E2 | E, A2 | A>
>(
  2,
  (trace, restore) =>
    <R, E, A, R2, E2, A2>(
      self: STM.STM<R, E, Option.Option<A>>,
      orElse: LazyArg<STM.STM<R2, E2, A2>>
    ): STM.STM<R2 | R, E2 | E, A2 | A> =>
      core.flatMap(
        self,
        Option.match((): STM.STM<R | R2, E | E2, A | A2> => restore(orElse)(), core.succeed)
      ).traced(trace)
)

/**
 * @internal
 */
export const someOrFail = Debug.dualWithTrace<
  <R, E, A, E2>(self: STM.STM<R, E, Option.Option<A>>, error: LazyArg<E2>) => STM.STM<R, E2 | E, A>,
  <E2>(error: LazyArg<E2>) => <R, E, A>(self: STM.STM<R, E, Option.Option<A>>) => STM.STM<R, E2 | E, A>
>(
  2,
  (trace, restore) =>
    (self, error) => core.flatMap(self, Option.match(() => core.failSync(restore(error)), core.succeed)).traced(trace)
)

/**
 * @internal
 */
export const someOrFailException = Debug.methodWithTrace((trace) =>
  <R, E, A>(
    self: STM.STM<R, E, Option.Option<A>>
  ): STM.STM<R, E | Cause.NoSuchElementException, A> =>
    pipe(
      core.matchSTM(
        self,
        core.fail,
        Option.match(() => core.fail(Cause.NoSuchElementException()), core.succeed)
      )
    ).traced(trace)
)

/**
 * @internal
 */
export const struct = Debug.methodWithTrace((trace) =>
  <NER extends Record<string, STM.STM<any, any, any>>>(
    r: EnforceNonEmptyRecord<NER> | Record<string, STM.STM<any, any, any>>
  ): STM.STM<
    [NER[keyof NER]] extends [{ [core.STMTypeId]: { _R: (_: never) => infer R } }] ? R : never,
    [NER[keyof NER]] extends [{ [core.STMTypeId]: { _E: (_: never) => infer E } }] ? E : never,
    {
      [K in keyof NER]: [NER[K]] extends [{ [core.STMTypeId]: { _A: (_: never) => infer A } }] ? A : never
    }
  > =>
    pipe(
      Object.entries(r),
      forEach(([_, e]) => pipe(e, core.map((a) => [_, a] as const))),
      core.map((values) => {
        const res = {}
        for (const [k, v] of values) {
          res[k] = v
        }
        return res
      })
    ).traced(trace) as any
)

/**
 * @internal
 */
export const succeedLeft = Debug.methodWithTrace((trace) =>
  <A>(value: A): STM.STM<never, never, Either.Either<A, never>> => core.succeed(Either.left(value)).traced(trace)
)

/**
 * @internal
 */
export const succeedNone = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, Option.Option<never>> => core.succeed(Option.none()).traced(trace)
)

/**
 * @internal
 */
export const succeedRight = Debug.methodWithTrace((trace) =>
  <A>(value: A): STM.STM<never, never, Either.Either<never, A>> => core.succeed(Either.right(value)).traced(trace)
)

/**
 * @internal
 */
export const succeedSome = Debug.methodWithTrace((trace) =>
  <A>(value: A): STM.STM<never, never, Option.Option<A>> => core.succeed(Option.some(value)).traced(trace)
)

/**
 * @internal
 */
export const summarized = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2, A3>(
    self: STM.STM<R, E, A>,
    summary: STM.STM<R2, E2, A2>,
    f: (before: A2, after: A2) => A3
  ) => STM.STM<R2 | R, E2 | E, readonly [A3, A]>,
  <R2, E2, A2, A3>(
    summary: STM.STM<R2, E2, A2>,
    f: (before: A2, after: A2) => A3
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, readonly [A3, A]>
>(
  3,
  (trace, restore) =>
    (self, summary, f) =>
      core.flatMap(
        summary,
        (start) =>
          core.flatMap(
            self,
            (value) =>
              core.map(
                summary,
                (end) => [restore(f)(start, end), value] as const
              )
          )
      ).traced(trace)
)

/**
 * @internal
 */
export const suspend = Debug.methodWithTrace((trace) =>
  <R, E, A>(evaluate: LazyArg<STM.STM<R, E, A>>): STM.STM<R, E, A> => flatten(core.sync(evaluate)).traced(trace)
)

/**
 * @internal
 */
export const tap = Debug.dualWithTrace<
  <R, E, A, R2, E2, _>(self: STM.STM<R, E, A>, f: (a: A) => STM.STM<R2, E2, _>) => STM.STM<R2 | R, E2 | E, A>,
  <A, R2, E2, _>(f: (a: A) => STM.STM<R2, E2, _>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, A>
>(2, (trace, restore) => (self, f) => pipe(self, core.flatMap((a) => pipe(restore(f)(a), as(a)))).traced(trace))

/**
 * @internal
 */
export const tapBoth = Debug.dualWithTrace<
  <R, E, R2, E2, A2, A, R3, E3, A3>(
    self: STM.STM<R, E, A>,
    f: (error: E) => STM.STM<R2, E2, A2>,
    g: (value: A) => STM.STM<R3, E3, A3>
  ) => STM.STM<R2 | R3 | R, E | E2 | E3, A>,
  <E, R2, E2, A2, A, R3, E3, A3>(
    f: (error: E) => STM.STM<R2, E2, A2>,
    g: (value: A) => STM.STM<R3, E3, A3>
  ) => <R>(self: STM.STM<R, E, A>) => STM.STM<R2 | R3 | R, E | E2 | E3, A>
>(3, (trace, restore) =>
  (self, f, g) =>
    core.matchSTM(
      self,
      (e) => pipe(restore(f)(e), core.zipRight(core.fail(e))),
      (a) => pipe(restore(g)(a), as(a))
    ).traced(trace))

/**
 * @internal
 */
export const tapError = Debug.dualWithTrace<
  <R, A, E, R2, E2, _>(self: STM.STM<R, E, A>, f: (error: E) => STM.STM<R2, E2, _>) => STM.STM<R2 | R, E | E2, A>,
  <E, R2, E2, _>(f: (error: E) => STM.STM<R2, E2, _>) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E | E2, A>
>(
  2,
  (trace, restore) =>
    (self, f) =>
      core.matchSTM(
        self,
        (e) => core.zipRight(restore(f)(e), core.fail(e)),
        core.succeed
      ).traced(trace)
)

/**
 * @internal
 */
export const tryCatch = Debug.methodWithTrace((trace, restore) =>
  <E, A>(
    attempt: () => A,
    onThrow: (u: unknown) => E
  ): Effect.Effect<never, E, A> =>
    suspend(() => {
      try {
        return core.succeed(restore(attempt)())
      } catch (error) {
        return core.fail(onThrow(error))
      }
    }).traced(trace)
)

/**
 * @internal
 */
export const tuple = Debug.methodWithTrace((trace) =>
  <T extends NonEmptyArraySTM>(
    ...t: T
  ): STM.STM<
    [T[number]] extends [{ [core.STMTypeId]: { _R: (_: never) => infer R } }] ? R : never,
    [T[number]] extends [{ [core.STMTypeId]: { _E: (_: never) => infer E } }] ? E : never,
    TupleSTM<T>
  > => pipe(collectAll(t), core.map(Chunk.toReadonlyArray)).traced(trace) as any
)

/**
 * @internal
 */
export const unit = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, void> => core.succeed(void 0).traced(trace)
)

/**
 * @internal
 */
export const unleft = Debug.methodWithTrace((trace) =>
  <R, E, A, A2>(self: STM.STM<R, Either.Either<E, A>, A2>): STM.STM<R, E, Either.Either<A2, A>> =>
    core.matchSTM(
      self,
      Either.match(core.fail, (a) => core.succeed(Either.right(a))),
      (a) => core.succeed(Either.left(a))
    ).traced(trace)
)

/**
 * @internal
 */
export const unless = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: LazyArg<boolean>) => STM.STM<R, E, Option.Option<A>>,
  (predicate: LazyArg<boolean>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, E, Option.Option<A>>
>(
  2,
  (trace, restore) =>
    (self, predicate) => suspend(() => restore(predicate)() ? succeedNone() : asSome(self)).traced(trace)
)

/**
 * @internal
 */
export const unlessSTM = Debug.dualWithTrace<
  <R, E, A, R2, E2>(
    self: STM.STM<R, E, A>,
    predicate: STM.STM<R2, E2, boolean>
  ) => STM.STM<R2 | R, E2 | E, Option.Option<A>>,
  <R2, E2>(
    predicate: STM.STM<R2, E2, boolean>
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, Option.Option<A>>
>(
  2,
  (trace) =>
    (self, predicate) => pipe(predicate, core.flatMap((bool) => bool ? succeedNone() : asSome(self))).traced(trace)
)

/**
 * @internal
 */
export const unright = Debug.methodWithTrace((trace) =>
  <R, E, A, A2>(
    self: STM.STM<R, Either.Either<A, E>, A2>
  ): STM.STM<R, E, Either.Either<A, A2>> =>
    core.matchSTM(
      self,
      Either.match((a) => core.succeed(Either.left(a)), core.fail),
      (a) => core.succeed(Either.right(a))
    ).traced(trace)
)

/**
 * @internal
 */
export const unsome = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, Option.Option<E>, A>): STM.STM<R, E, Option.Option<A>> =>
    core.matchSTM(
      self,
      Option.match(() => core.succeed(Option.none()), core.fail),
      (a) => core.succeed(Option.some(a))
    ).traced(trace)
)

/**
 * @internal
 */
export const validateAll = Debug.dualWithTrace<
  <R, E, A, B>(
    elements: Iterable<A>,
    f: (a: A) => STM.STM<R, E, B>
  ) => STM.STM<R, Chunk.NonEmptyChunk<E>, Chunk.Chunk<B>>,
  <R, E, A, B>(
    f: (a: A) => STM.STM<R, E, B>
  ) => (elements: Iterable<A>) => STM.STM<R, Chunk.NonEmptyChunk<E>, Chunk.Chunk<B>>
>(2, (trace, restore) =>
  (elements, f) =>
    pipe(
      elements,
      partition(restore(f)),
      core.flatMap(([errors, values]) =>
        Chunk.isNonEmpty(errors) ?
          core.fail(errors) :
          core.succeed(values)
      )
    ).traced(trace))

/**
 * @internal
 */
export const validateFirst = Debug.dualWithTrace<
  <R, E, A, B>(elements: Iterable<A>, f: (a: A) => STM.STM<R, E, B>) => STM.STM<R, Chunk.Chunk<E>, B>,
  <R, E, A, B>(f: (a: A) => STM.STM<R, E, B>) => (elements: Iterable<A>) => STM.STM<R, Chunk.Chunk<E>, B>
>(2, (trace, restore) => (elements, f) => pipe(elements, forEach((a) => flip(restore(f)(a))), flip).traced(trace))

/**
 * @internal
 */
export const when = Debug.dualWithTrace<
  <R, E, A>(self: STM.STM<R, E, A>, predicate: LazyArg<boolean>) => STM.STM<R, E, Option.Option<A>>,
  (predicate: LazyArg<boolean>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R, E, Option.Option<A>>
>(
  2,
  (trace, restore) =>
    (self, predicate) => suspend(() => restore(predicate)() ? asSome(self) : succeedNone()).traced(trace)
)

/**
 * @internal
 */
export const whenCase = Debug.methodWithTrace((trace, restore) =>
  <R, E, A, B>(
    evaluate: () => A,
    pf: (a: A) => Option.Option<STM.STM<R, E, B>>
  ): STM.STM<R, E, Option.Option<B>> =>
    suspend(() => pipe(restore(pf)(restore(evaluate)()), Option.map(asSome), Option.getOrElse(succeedNone)))
      .traced(trace)
)

/**
 * @internal
 */
export const whenCaseSTM = Debug.dualWithTrace<
  <R, E, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    pf: (a: A) => Option.Option<STM.STM<R2, E2, A2>>
  ) => STM.STM<R2 | R, E2 | E, Option.Option<A2>>,
  <A, R2, E2, A2>(
    pf: (a: A) => Option.Option<STM.STM<R2, E2, A2>>
  ) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, Option.Option<A2>>
>(2, (trace, restore) => (self, pf) => pipe(self, core.flatMap((a) => whenCase(() => a, restore(pf)))).traced(trace))

/**
 * @internal
 */
export const whenSTM = Debug.dualWithTrace<
  <R, E, A, R2, E2>(
    self: STM.STM<R, E, A>,
    predicate: STM.STM<R2, E2, boolean>
  ) => STM.STM<R2 | R, E2 | E, Option.Option<A>>,
  <R2, E2>(
    predicate: STM.STM<R2, E2, boolean>
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R2 | R, E2 | E, Option.Option<A>>
>(
  2,
  (trace) =>
    (self, predicate) => pipe(predicate, core.flatMap((bool) => bool ? asSome(self) : succeedNone())).traced(trace)
)
