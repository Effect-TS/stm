import * as Cause from "@effect/io/Cause"
import * as Debug from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import type * as FiberId from "@effect/io/Fiber/Id"
import * as FiberRef from "@effect/io/FiberRef"
import * as internalCause from "@effect/io/internal_effect_untraced/cause"
import { proto as effectProto, withFiberRuntime } from "@effect/io/internal_effect_untraced/core"
import { OP_COMMIT } from "@effect/io/internal_effect_untraced/opCodes/effect"
import type * as Scheduler from "@effect/io/Scheduler"
import * as OpCodes from "@effect/stm/internal_effect_untraced/opCodes/stm"
import * as TExitOpCodes from "@effect/stm/internal_effect_untraced/opCodes/tExit"
import * as TryCommitOpCodes from "@effect/stm/internal_effect_untraced/opCodes/tryCommit"
import * as Journal from "@effect/stm/internal_effect_untraced/stm/journal"
import * as STMState from "@effect/stm/internal_effect_untraced/stm/stmState"
import * as TExit from "@effect/stm/internal_effect_untraced/stm/tExit"
import * as TryCommit from "@effect/stm/internal_effect_untraced/stm/tryCommit"
import * as TxnId from "@effect/stm/internal_effect_untraced/stm/txnId"
import type * as STM from "@effect/stm/STM"
import * as Either from "@fp-ts/core/Either"
import type { LazyArg } from "@fp-ts/core/Function"
import { constVoid, pipe } from "@fp-ts/core/Function"
import * as Chunk from "@fp-ts/data/Chunk"
import type * as Context from "@fp-ts/data/Context"

/** @internal */
const STMSymbolKey = "@effect/stm/STM"

/** @internal */
export const STMTypeId: STM.STMTypeId = Symbol.for(
  STMSymbolKey
) as STM.STMTypeId

/** @internal */
export type Primitive =
  | STMEffect
  | STMOnFailure
  | STMOnRetry
  | STMOnSuccess
  | STMProvide
  | STMSync
  | STMSucceed
  | STMRetry
  | STMFail
  | STMDie
  | STMTraced
  | STMInterrupt

/** @internal */
type Op<Tag extends string, Body = {}> = STM.STM<never, never, never> & Body & {
  readonly _tag: OP_COMMIT
  readonly _stmTag: Tag
}

/** @internal */
interface STMEffect extends
  Op<OpCodes.OP_WITH_STM_RUNTIME, {
    readonly evaluate: (
      runtime: STMDriver<unknown, unknown, unknown>
    ) => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMOnFailure extends
  Op<OpCodes.OP_ON_FAILURE, {
    readonly first: STM.STM<unknown, unknown, unknown>
    readonly failK: (error: unknown) => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMOnRetry extends
  Op<OpCodes.OP_ON_RETRY, {
    readonly first: STM.STM<unknown, unknown, unknown>
    readonly retryK: () => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMOnSuccess extends
  Op<OpCodes.OP_ON_SUCCESS, {
    readonly first: STM.STM<unknown, unknown, unknown>
    readonly successK: (a: unknown) => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMProvide extends
  Op<OpCodes.OP_PROVIDE, {
    readonly stm: STM.STM<unknown, unknown, unknown>
    readonly provide: (context: Context.Context<unknown>) => Context.Context<unknown>
  }>
{}

/** @internal */
interface STMSync extends
  Op<OpCodes.OP_SYNC, {
    readonly evaluate: () => unknown
  }>
{}

/** @internal */
interface STMSucceed extends
  Op<OpCodes.OP_SUCCEED, {
    readonly value: unknown
  }>
{}

/** @internal */
interface STMRetry extends Op<OpCodes.OP_RETRY, {}> {}

/** @internal */
interface STMFail extends
  Op<OpCodes.OP_FAIL, {
    readonly error: LazyArg<unknown>
  }>
{}

/** @internal */
interface STMDie extends
  Op<OpCodes.OP_DIE, {
    readonly defect: LazyArg<unknown>
  }>
{}

/** @internal */
interface STMTraced extends
  Op<OpCodes.OP_TRACED, {
    readonly stm: STM.STM<unknown, unknown, unknown>
    readonly trace: Debug.Trace
  }>
{}

/** @internal */
interface STMInterrupt extends Op<OpCodes.OP_INTERRUPT, {}> {}

/** @internal */
const stmVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
const proto = Object.assign({}, {
  ...effectProto,
  [STMTypeId]: stmVariance,
  _tag: OP_COMMIT,
  commit(this: STM.STM<any, any, any>): Effect.Effect<any, any, any> {
    return Debug.untraced(() => commit(this))
  },
  traced(this: STM.STM<any, any, any>, trace: string | undefined): STM.STM<any, any, any> {
    if (!trace) {
      return this
    }
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_TRACED
    stm.stm = this
    stm.trace = trace
    return stm
  }
})

/**
 * @internal
 */
export const commit = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): Effect.Effect<R, E, A> =>
    unsafeAtomically(self, constVoid, constVoid).traced(trace)
)

/**
 * @internal
 */
export const unsafeAtomically = Debug.methodWithTrace((trace) =>
  <R, E, A>(
    self: STM.STM<R, E, A>,
    onDone: (exit: Exit.Exit<E, A>) => unknown,
    onInterrupt: LazyArg<unknown>
  ): Effect.Effect<R, E, A> =>
    withFiberRuntime<R, E, A>((state) => {
      const fiberId = state.id()
      const env = state.getFiberRef(FiberRef.currentContext) as Context.Context<R>
      const scheduler = state.getFiberRef(FiberRef.currentScheduler)
      const commitResult = tryCommitSync(fiberId, self, env, scheduler)
      switch (commitResult._tag) {
        case TryCommitOpCodes.OP_DONE: {
          onDone(commitResult.exit)
          return Effect.done(commitResult.exit)
        }
        case TryCommitOpCodes.OP_SUSPEND: {
          const txnId = TxnId.make()
          const state: { value: STMState.STMState<E, A> } = { value: STMState.running }
          const effect = Effect.async(
            (k: (effect: Effect.Effect<R, E, A>) => unknown): void =>
              tryCommitAsync(fiberId, self, txnId, state, env, scheduler, k)
          )
          return Effect.uninterruptibleMask((restore) =>
            pipe(
              restore(effect),
              Effect.catchAllCause((cause) => {
                let currentState = state.value
                if (STMState.isRunning(currentState)) {
                  state.value = STMState.interrupted
                }
                currentState = state.value
                if (STMState.isDone(currentState)) {
                  onDone(currentState.exit)
                  return Effect.done(currentState.exit)
                }
                onInterrupt()
                return Effect.failCause(cause)
              })
            )
          )
        }
      }
    }).traced(trace)
)

/** @internal */
const tryCommit = <R, E, A>(
  fiberId: FiberId.FiberId,
  stm: STM.STM<R, E, A>,
  state: { value: STMState.STMState<E, A> },
  env: Context.Context<R>,
  scheduler: Scheduler.Scheduler
): TryCommit.TryCommit<E, A> => {
  const journal: Journal.Journal = new Map()
  const tExit = new STMDriver(stm, journal, fiberId, env).run()
  const analysis = Journal.analyzeJournal(journal)

  if (analysis === Journal.JournalAnalysisReadWrite) {
    Journal.commitJournal(journal)
  } else if (analysis === Journal.JournalAnalysisInvalid) {
    throw new Error("BUG: STM.TryCommit.tryCommit - please report an issue at https://github.com/Effect-TS/io/issues")
  }

  switch (tExit._tag) {
    case TExitOpCodes.OP_SUCCEED: {
      state.value = STMState.fromTExit(tExit)
      return completeTodos(Exit.succeed(tExit.value), journal, scheduler)
    }
    case TExitOpCodes.OP_FAIL: {
      state.value = STMState.fromTExit(tExit)
      const cause = Cause.fail(tExit.error)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 ?
            Cause.annotated(cause, tExit.annotation) :
            cause
        ),
        journal,
        scheduler
      )
    }
    case TExitOpCodes.OP_DIE: {
      state.value = STMState.fromTExit(tExit)
      const cause = Cause.die(tExit.defect)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 ?
            Cause.annotated(cause, tExit.annotation) :
            cause
        ),
        journal,
        scheduler
      )
    }
    case TExitOpCodes.OP_INTERRUPT: {
      state.value = STMState.fromTExit(tExit)
      const cause = Cause.interrupt(fiberId)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 ?
            Cause.annotated(cause, tExit.annotation) :
            cause
        ),
        journal,
        scheduler
      )
    }
    case TExitOpCodes.OP_RETRY: {
      return TryCommit.suspend(journal)
    }
  }
}

/** @internal */
const tryCommitSync = <R, E, A>(
  fiberId: FiberId.FiberId,
  stm: STM.STM<R, E, A>,
  env: Context.Context<R>,
  scheduler: Scheduler.Scheduler
): TryCommit.TryCommit<E, A> => {
  const journal: Journal.Journal = new Map()
  const tExit = new STMDriver(stm, journal, fiberId, env).run()
  const analysis = Journal.analyzeJournal(journal)

  if (analysis === Journal.JournalAnalysisReadWrite && TExit.isSuccess(tExit)) {
    Journal.commitJournal(journal)
  } else if (analysis === Journal.JournalAnalysisInvalid) {
    throw new Error(
      "BUG: STM.TryCommit.tryCommitSync - please report an issue at https://github.com/Effect-TS/io/issues"
    )
  }

  switch (tExit._tag) {
    case TExitOpCodes.OP_SUCCEED: {
      return completeTodos(Exit.succeed(tExit.value), journal, scheduler)
    }
    case TExitOpCodes.OP_FAIL: {
      const cause = Cause.fail(tExit.error)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 ?
            Cause.annotated(cause, tExit.annotation) :
            cause
        ),
        journal,
        scheduler
      )
    }
    case TExitOpCodes.OP_DIE: {
      const cause = Cause.die(tExit.defect)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 ?
            Cause.annotated(cause, tExit.annotation) :
            cause
        ),
        journal,
        scheduler
      )
    }
    case TExitOpCodes.OP_INTERRUPT: {
      const cause = Cause.interrupt(fiberId)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 ?
            Cause.annotated(cause, tExit.annotation) :
            cause
        ),
        journal,
        scheduler
      )
    }
    case TExitOpCodes.OP_RETRY: {
      return TryCommit.suspend(journal)
    }
  }
}

/** @internal */
const tryCommitAsync = <R, E, A>(
  fiberId: FiberId.FiberId,
  self: STM.STM<R, E, A>,
  txnId: TxnId.TxnId,
  state: { value: STMState.STMState<E, A> },
  context: Context.Context<R>,
  scheduler: Scheduler.Scheduler,
  k: (effect: Effect.Effect<R, E, A>) => unknown
) => {
  if (STMState.isRunning(state.value)) {
    const result = tryCommit(fiberId, self, state, context, scheduler)
    switch (result._tag) {
      case TryCommitOpCodes.OP_DONE: {
        completeTryCommit(result.exit, k)
        break
      }
      case TryCommitOpCodes.OP_SUSPEND: {
        Journal.addTodo(
          txnId,
          result.journal,
          () => tryCommitAsync(fiberId, self, txnId, state, context, scheduler, k)
        )
        break
      }
    }
  }
}

/** @internal */
const completeTodos = <E, A>(
  exit: Exit.Exit<E, A>,
  journal: Journal.Journal,
  scheduler: Scheduler.Scheduler
): TryCommit.TryCommit<E, A> => {
  const todos = Journal.collectTodos(journal)
  if (todos.size > 0) {
    scheduler.scheduleTask(() => Journal.execTodos(todos))
  }
  return TryCommit.done(exit)
}

/** @internal */
const completeTryCommit = <R, E, A>(
  exit: Exit.Exit<E, A>,
  k: (effect: Effect.Effect<R, E, A>) => unknown
): void => {
  k(Effect.done(exit))
}

/** @internal */
type Continuation = STMOnFailure | STMOnSuccess | STMOnRetry | STMTraced

/** @internal */
export class STMDriver<R, E, A> {
  private contStack: Array<Continuation> = []
  private env: Context.Context<unknown>
  private traceStack: Array<NonNullable<Debug.Trace>> = []

  constructor(
    readonly self: STM.STM<R, E, A>,
    readonly journal: Journal.Journal,
    readonly fiberId: FiberId.FiberId,
    r0: Context.Context<R>
  ) {
    this.env = r0 as Context.Context<unknown>
  }

  getEnv(): Context.Context<R> {
    return this.env
  }

  pushStack(cont: Continuation) {
    this.contStack.push(cont)
    if ("trace" in cont && cont.trace) {
      this.traceStack.push(cont.trace)
    }
  }

  popStack() {
    const item = this.contStack.pop()
    if (item) {
      if ("trace" in item && item.trace) {
        this.traceStack.pop()
      }
      return item
    }
    return
  }

  stackToLines(): Chunk.Chunk<Debug.Trace> {
    if (this.traceStack.length === 0) {
      return Chunk.empty()
    }
    const lines: Array<Debug.Trace> = []
    let current = this.contStack.length - 1
    while (current >= 0 && lines.length < Debug.runtimeDebug.traceStackLimit) {
      const value = this.contStack[current]!
      switch (value._stmTag) {
        case OpCodes.OP_TRACED: {
          if (value.trace) {
            lines.push(value.trace)
          }
          break
        }
      }
      current = current - 1
    }
    return Chunk.unsafeFromArray(lines)
  }

  nextSuccess() {
    let current = this.popStack()
    while (current !== undefined && current._stmTag !== OpCodes.OP_ON_SUCCESS) {
      current = this.popStack()
    }
    return current
  }

  nextFailure() {
    let current = this.popStack()
    while (current !== undefined && current._stmTag !== OpCodes.OP_ON_FAILURE) {
      current = this.popStack()
    }
    return current
  }

  nextRetry() {
    let current = this.popStack()
    while (current !== undefined && current._stmTag !== OpCodes.OP_ON_RETRY) {
      current = this.popStack()
    }
    return current
  }

  run(): TExit.TExit<E, A> {
    let curr = this.self as Primitive | undefined
    let exit: TExit.TExit<unknown, unknown> | undefined = undefined
    while (exit === undefined && curr !== undefined) {
      try {
        const current = curr
        switch (current._stmTag) {
          case OpCodes.OP_TRACED: {
            this.pushStack(current)
            curr = current.stm as Primitive
            break
          }
          case OpCodes.OP_DIE: {
            const annotation = new internalCause.StackAnnotation(this.stackToLines())
            exit = TExit.die(current.defect(), annotation)
            break
          }
          case OpCodes.OP_FAIL: {
            const annotation = new internalCause.StackAnnotation(this.stackToLines())
            const cont = this.nextFailure()
            if (cont === undefined) {
              exit = TExit.fail(current.error(), annotation)
            } else {
              curr = cont.failK(current.error()) as Primitive
            }
            break
          }
          case OpCodes.OP_RETRY: {
            const cont = this.nextRetry()
            if (cont === undefined) {
              exit = TExit.retry
            } else {
              curr = cont.retryK() as Primitive
            }
            break
          }
          case OpCodes.OP_INTERRUPT: {
            const annotation = new internalCause.StackAnnotation(this.stackToLines())
            exit = TExit.interrupt(this.fiberId, annotation)
            break
          }
          case OpCodes.OP_WITH_STM_RUNTIME: {
            curr = current.evaluate(this as STMDriver<unknown, unknown, unknown>) as Primitive
            break
          }
          case OpCodes.OP_ON_SUCCESS:
          case OpCodes.OP_ON_FAILURE:
          case OpCodes.OP_ON_RETRY: {
            this.pushStack(current)
            curr = current.first as Primitive
            break
          }
          case OpCodes.OP_PROVIDE: {
            const env = this.env
            this.env = current.provide(env)
            curr = pipe(
              current.stm,
              ensuring(sync(() => (this.env = env)))
            ) as Primitive
            break
          }
          case OpCodes.OP_SUCCEED: {
            const value = current.value
            const cont = this.nextSuccess()
            if (cont === undefined) {
              exit = TExit.succeed(value)
            } else {
              curr = cont.successK(value) as Primitive
            }
            break
          }
          case OpCodes.OP_SYNC: {
            const value = current.evaluate()
            const cont = this.nextSuccess()
            if (cont === undefined) {
              exit = TExit.succeed(value)
            } else {
              curr = cont.successK(value) as Primitive
            }
            break
          }
        }
      } catch (e) {
        curr = die(e) as Primitive
      }
    }
    return exit as TExit.TExit<E, A>
  }
}

/**
 * @internal
 */
export const catchAll = Debug.dualWithTrace<
  <R, A, E, R1, E1, B>(
    self: STM.STM<R, E, A>,
    f: (e: E) => STM.STM<R1, E1, B>
  ) => STM.STM<R1 | R, E1, B | A>,
  <E, R1, E1, B>(
    f: (e: E) => STM.STM<R1, E1, B>
  ) => <R, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1, B | A>
>(2, (trace, restore) =>
  (self, f) => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_ON_FAILURE
    stm.first = self
    stm.failK = restore(f)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/**
 * @internal
 */
export const die = Debug.methodWithTrace((trace) =>
  (defect: unknown): STM.STM<never, never, never> => dieSync(() => defect).traced(trace)
)

/**
 * @internal
 */
export const dieMessage = Debug.methodWithTrace((trace) =>
  (message: string): STM.STM<never, never, never> => dieSync(() => Cause.RuntimeException(message)).traced(trace)
)

/**
 * @internal
 */
export const dieSync = Debug.methodWithTrace((trace, restore) =>
  (evaluate: LazyArg<unknown>): STM.STM<never, never, never> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_DIE
    stm.defect = restore(evaluate)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const effect = Debug.methodWithTrace((trace, restore) =>
  <R, A>(
    f: (journal: Journal.Journal, fiberId: FiberId.FiberId, environment: Context.Context<R>) => A
  ): STM.STM<R, never, A> => withSTMRuntime((_) => succeed(restore(f)(_.journal, _.fiberId, _.getEnv()))).traced(trace)
)

/**
 * @internal
 */
export const ensuring = Debug.dualWithTrace<
  <R, E, A, R1, B>(self: STM.STM<R, E, A>, finalizer: STM.STM<R1, never, B>) => STM.STM<R1 | R, E, A>,
  <R1, B>(finalizer: STM.STM<R1, never, B>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E, A>
>(2, (trace) =>
  (self, finalizer) =>
    pipe(
      self,
      matchSTM(
        (e) => pipe(finalizer, zipRight(fail(e))),
        (a) => pipe(finalizer, zipRight(succeed(a)))
      )
    ).traced(trace))

/**
 * @internal
 */
export const fail = Debug.methodWithTrace((trace) =>
  <E>(error: E): STM.STM<never, E, never> => failSync(() => error).traced(trace)
)

/**
 * @internal
 */
export const failSync = Debug.methodWithTrace((trace, restore) =>
  <E>(evaluate: LazyArg<E>): STM.STM<never, E, never> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_FAIL
    stm.error = restore(evaluate)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const flatMap = Debug.dualWithTrace<
  <R, E, A, R1, E1, A2>(self: STM.STM<R, E, A>, f: (a: A) => STM.STM<R1, E1, A2>) => STM.STM<R1 | R, E1 | E, A2>,
  <A, R1, E1, A2>(f: (a: A) => STM.STM<R1, E1, A2>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A2>
>(2, (trace, restore) =>
  (self, f) => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_ON_SUCCESS
    stm.first = self
    stm.successK = restore(f)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/**
 * @internal
 */
export const matchSTM = Debug.dualWithTrace<
  <R, E, R1, E1, A1, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    onFailure: (e: E) => STM.STM<R1, E1, A1>,
    onSuccess: (a: A) => STM.STM<R2, E2, A2>
  ) => STM.STM<R1 | R2 | R, E1 | E2, A1 | A2>,
  <E, R1, E1, A1, A, R2, E2, A2>(
    onFailure: (e: E) => STM.STM<R1, E1, A1>,
    onSuccess: (a: A) => STM.STM<R2, E2, A2>
  ) => <R>(self: STM.STM<R, E, A>) => STM.STM<R1 | R2 | R, E1 | E2, A1 | A2>
>(3, (trace, restore) =>
  <R, E, R1, E1, A1, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    onFailure: (e: E) => STM.STM<R1, E1, A1>,
    onSuccess: (a: A) => STM.STM<R2, E2, A2>
  ): STM.STM<R1 | R2 | R, E1 | E2, A1 | A2> =>
    pipe(
      self,
      map(Either.right),
      catchAll((e) => pipe(restore(onFailure)(e), map(Either.left))),
      flatMap((either): STM.STM<R | R1 | R2, E1 | E2, A1 | A2> => {
        switch (either._tag) {
          case "Left": {
            return succeed(either.left)
          }
          case "Right": {
            return restore(onSuccess)(either.right)
          }
        }
      })
    ).traced(trace))

/**
 * @internal
 */
export const interrupt = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, never> =>
    withSTMRuntime((_) => {
      const stm = Object.create(proto)
      stm._stmTag = OpCodes.OP_INTERRUPT
      stm.fiberId = _.fiberId
      stm.trace = void 0
      if (trace) {
        return stm.traced(trace)
      }
      return stm
    })
)

/**
 * @internal
 */
export const interruptWith = Debug.methodWithTrace((trace) =>
  (fiberId: FiberId.FiberId): STM.STM<never, never, never> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_INTERRUPT
    stm.fiberId = fiberId
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const map = Debug.dualWithTrace<
  <R, E, A, B>(self: STM.STM<R, E, A>, f: (a: A) => B) => STM.STM<R, E, B>,
  <A, B>(f: (a: A) => B) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, B>
>(2, (trace, resume) => (self, f) => pipe(self, flatMap((a) => sync(() => resume(f)(a)))).traced(trace))

/**
 * @internal
 */
export const orTry = Debug.dualWithTrace<
  <R, E, A, R1, E1, A1>(self: STM.STM<R, E, A>, that: () => STM.STM<R1, E1, A1>) => STM.STM<R1 | R, E1 | E, A1 | A>,
  <R1, E1, A1>(that: () => STM.STM<R1, E1, A1>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A1 | A>
>(2, (trace, restore) =>
  (self, that) => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_ON_RETRY
    stm.first = self
    stm.retryK = restore(that)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/**
 * @internal
 */
export const retry = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, never> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_RETRY
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const succeed = Debug.methodWithTrace((trace) =>
  <A>(value: A): STM.STM<never, never, A> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_SUCCEED
    stm.value = value
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const sync = Debug.methodWithTrace((trace, restore) =>
  <A>(evaluate: () => A): STM.STM<never, never, A> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_SYNC
    stm.evaluate = restore(evaluate)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const contramapContext = Debug.dualWithTrace<
  <E, A, R0, R>(self: STM.STM<R, E, A>, f: (context: Context.Context<R0>) => Context.Context<R>) => STM.STM<R0, E, A>,
  <R0, R>(
    f: (context: Context.Context<R0>) => Context.Context<R>
  ) => <E, A>(self: STM.STM<R, E, A>) => STM.STM<R0, E, A>
>(2, (trace, restore) =>
  (self, f) => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_PROVIDE
    stm.stm = self
    stm.provide = restore(f)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/**
 * @internal
 */
export const withSTMRuntime = Debug.methodWithTrace((trace, restore) =>
  <R, E, A>(
    f: (runtime: STMDriver<unknown, unknown, unknown>) => STM.STM<R, E, A>
  ): STM.STM<R, E, A> => {
    const stm = Object.create(proto)
    stm._stmTag = OpCodes.OP_WITH_STM_RUNTIME
    stm.evaluate = restore(f)
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/**
 * @internal
 */
export const zip = Debug.dualWithTrace<
  <R, E, A, R1, E1, A1>(
    self: STM.STM<R, E, A>,
    that: STM.STM<R1, E1, A1>
  ) => STM.STM<R1 | R, E1 | E, readonly [A, A1]>,
  <R1, E1, A1>(
    that: STM.STM<R1, E1, A1>
  ) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, readonly [A, A1]>
>(2, (trace) => (self, that) => pipe(self, zipWith(that, (a, a1) => [a, a1] as const)).traced(trace))

/**
 * @internal
 */
export const zipLeft = Debug.dualWithTrace<
  <R, E, A, R1, E1, A1>(self: STM.STM<R, E, A>, that: STM.STM<R1, E1, A1>) => STM.STM<R1 | R, E1 | E, A>,
  <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A>
>(2, (trace) => (self, that) => pipe(self, flatMap((a) => pipe(that, map(() => a)))).traced(trace))

/**
 * @internal
 */
export const zipRight = Debug.dualWithTrace<
  <R, E, A, R1, E1, A1>(self: STM.STM<R, E, A>, that: STM.STM<R1, E1, A1>) => STM.STM<R1 | R, E1 | E, A1>,
  <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A1>
>(2, (trace) => (self, that) => pipe(self, flatMap(() => that)).traced(trace))

/**
 * @internal
 */
export const zipWith = Debug.dualWithTrace<
  <R, E, R1, E1, A1, A, A2>(
    self: STM.STM<R, E, A>,
    that: STM.STM<R1, E1, A1>,
    f: (a: A, b: A1) => A2
  ) => STM.STM<R1 | R, E1 | E, A2>,
  <R1, E1, A1, A, A2>(
    that: STM.STM<R1, E1, A1>,
    f: (a: A, b: A1) => A2
  ) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A2>
>(
  3,
  (trace, restore) =>
    (self, that, f) => pipe(self, flatMap((a) => pipe(that, map((b) => restore(f)(a, b))))).traced(trace)
)
