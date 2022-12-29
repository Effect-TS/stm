import * as Cause from "@effect/io/Cause"
import { getCallTrace, isTraceEnabled, runtimeDebug } from "@effect/io/Debug"
import type * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import type * as FiberId from "@effect/io/Fiber/Id"
import { StackAnnotation } from "@effect/io/internal/cause"
import * as effectCore from "@effect/io/internal/core"
import * as EffectOpCodes from "@effect/io/internal/opCodes/effect"
import { RingBuffer } from "@effect/io/internal/support"
import type * as Scheduler from "@effect/io/Scheduler"
import * as OpCodes from "@effect/stm/internal/opCodes/stm"
import * as TExitOpCodes from "@effect/stm/internal/opCodes/tExit"
import * as TryCommitOpCodes from "@effect/stm/internal/opCodes/tryCommit"
import * as Journal from "@effect/stm/internal/stm/journal"
import * as STMState from "@effect/stm/internal/stm/stmState"
import * as TExit from "@effect/stm/internal/stm/tExit"
import * as TryCommit from "@effect/stm/internal/stm/tryCommit"
import * as TxnId from "@effect/stm/internal/stm/txnId"
import type * as STM from "@effect/stm/STM"
import * as Chunk from "@fp-ts/data/Chunk"
import type * as Context from "@fp-ts/data/Context"
import * as Either from "@fp-ts/data/Either"
import * as Equal from "@fp-ts/data/Equal"
import type { LazyArg } from "@fp-ts/data/Function"
import { constVoid, pipe } from "@fp-ts/data/Function"

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
  | STMInterrupt

/** @internal */
type Op<OpCode extends number, Body = {}> = STM.STM<never, never, never> & Body & {
  readonly op: EffectOpCodes.OP_COMMIT
  readonly opSTM: OpCode
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
interface STMInterrupt extends Op<OpCodes.OP_INTERRUPT, {}> {}

/** @internal */
const stmVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
const proto = Object.assign({}, {
  ...effectCore.proto,
  [STMTypeId]: stmVariance,
  op: EffectOpCodes.OP_COMMIT,
  commit(this: STM.STM<any, any, any>): Effect.Effect<any, any, any> {
    return commit(this)
  },
  traced(this: STM.STM<any, any, any>, trace: string | undefined): STM.STM<any, any, any> {
    if (!isTraceEnabled() || trace === this["trace"]) {
      return this
    }
    const fresh = Object.create(proto)
    Object.assign(fresh, this)
    fresh.trace = trace
    return fresh
  }
})

/**
 * @macro traced
 * @internal
 */
export const commit = <R, E, A>(self: STM.STM<R, E, A>): Effect.Effect<R, E, A> => {
  const trace = getCallTrace()
  return unsafeAtomically(self, constVoid, constVoid).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unsafeAtomically = <R, E, A>(
  self: STM.STM<R, E, A>,
  onDone: (exit: Exit.Exit<E, A>) => unknown,
  onInterrupt: LazyArg<unknown>
): Effect.Effect<R, E, A> => {
  const trace = getCallTrace()
  return effectCore.withFiberRuntime<R, E, A>((state) => {
    const fiberId = state.id()
    const env = state.getFiberRef(effectCore.currentEnvironment) as Context.Context<R>
    const scheduler = state.getFiberRef(effectCore.currentScheduler)
    const commitResult = tryCommitSync(fiberId, self, env, scheduler)
    switch (commitResult.op) {
      case TryCommitOpCodes.OP_DONE: {
        onDone(commitResult.exit)
        return effectCore.done(commitResult.exit)
      }
      case TryCommitOpCodes.OP_SUSPEND: {
        const txnId = TxnId.make()
        const state: { value: STMState.STMState<E, A> } = { value: STMState.running }
        const effect = effectCore.async(
          (k: (effect: Effect.Effect<R, E, A>) => unknown): void =>
            tryCommitAsync(fiberId, self, txnId, state, env, scheduler, k)
        )
        return effectCore.uninterruptibleMask((restore) =>
          pipe(
            restore(effect),
            effectCore.catchAllCause((cause) => {
              let currentState = state.value
              if (STMState.isRunning(currentState)) {
                state.value = STMState.interrupted
              }
              currentState = state.value
              if (STMState.isDone(currentState)) {
                onDone(currentState.exit)
                return effectCore.done(currentState.exit)
              }
              onInterrupt()
              return effectCore.failCause(cause)
            })
          )
        )
      }
    }
  }).traced(trace)
}

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
    state.value = STMState.fromTExit(tExit)
    Journal.commitJournal(journal)
  } else if (analysis === Journal.JournalAnalysisInvalid) {
    throw new Error("BUG: STM.TryCommit.tryCommit - please report an issue at https://github.com/Effect-TS/io/issues")
  }

  switch (tExit.op) {
    case TExitOpCodes.OP_SUCCEED: {
      return completeTodos(Exit.succeed(tExit.value), journal, scheduler)
    }
    case TExitOpCodes.OP_FAIL: {
      const cause = Cause.fail(tExit.error)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 || tExit.annotation.execution.length > 0 ?
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
          tExit.annotation.stack.length > 0 || tExit.annotation.execution.length > 0 ?
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
          tExit.annotation.stack.length > 0 || tExit.annotation.execution.length > 0 ?
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

  switch (tExit.op) {
    case TExitOpCodes.OP_SUCCEED: {
      return completeTodos(Exit.succeed(tExit.value), journal, scheduler)
    }
    case TExitOpCodes.OP_FAIL: {
      const cause = Cause.fail(tExit.error)
      return completeTodos(
        Exit.failCause(
          tExit.annotation.stack.length > 0 || tExit.annotation.execution.length > 0 ?
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
          tExit.annotation.stack.length > 0 || tExit.annotation.execution.length > 0 ?
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
          tExit.annotation.stack.length > 0 || tExit.annotation.execution.length > 0 ?
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
    switch (result.op) {
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
  k(effectCore.done(exit))
}

/** @internal */
type Continuation = STMOnFailure | STMOnSuccess | STMOnRetry

/** @internal */
export class STMDriver<R, E, A> {
  private contStack: Array<Continuation> = []
  private env: Context.Context<unknown>
  private execution: RingBuffer<string> | undefined
  private tracesInStack = 0

  constructor(
    readonly self: STM.STM<R, E, A>,
    readonly journal: Journal.Journal,
    readonly fiberId: FiberId.FiberId,
    r0: Context.Context<R>
  ) {
    Equal.considerByRef(this)
    this.env = r0 as Context.Context<unknown>
  }

  private logTrace(trace: string | undefined) {
    if (trace) {
      if (!this.execution) {
        this.execution = new RingBuffer<string>(runtimeDebug.traceExecutionLimit)
      }
      this.execution.push(trace)
    }
  }

  getEnv(): Context.Context<R> {
    return this.env
  }

  pushStack(cont: Continuation) {
    this.contStack.push(cont)
    if ("trace" in cont) {
      this.tracesInStack++
    }
  }

  popStack() {
    const item = this.contStack.pop()
    if (item) {
      if ("trace" in item) {
        this.tracesInStack--
      }
      return item
    }
    return
  }

  stackToLines(): Chunk.Chunk<string> {
    if (this.tracesInStack === 0) {
      return Chunk.empty()
    }
    const lines: Array<string> = []
    let current = this.contStack.length - 1
    let last: undefined | string = undefined
    let seen = 0
    while (current >= 0 && lines.length < runtimeDebug.traceStackLimit && seen < this.tracesInStack) {
      const value = this.contStack[current]!
      switch (value.opSTM) {
        case OpCodes.OP_ON_SUCCESS:
        case OpCodes.OP_ON_FAILURE:
        case OpCodes.OP_ON_RETRY: {
          if (value.trace) {
            seen++
            if (value.trace !== last) {
              last = value.trace
              lines.push(value.trace)
            }
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
    while (current !== undefined && current.opSTM !== OpCodes.OP_ON_SUCCESS) {
      current = this.popStack()
    }
    return current
  }

  nextFailure() {
    let current = this.popStack()
    while (current !== undefined && current.opSTM !== OpCodes.OP_ON_FAILURE) {
      current = this.popStack()
    }
    return current
  }

  nextRetry() {
    let current = this.popStack()
    while (current !== undefined && current.opSTM !== OpCodes.OP_ON_RETRY) {
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
        switch (current.opSTM) {
          case OpCodes.OP_DIE: {
            this.logTrace(curr.trace)
            const annotation = new StackAnnotation(
              this.stackToLines(),
              this.execution?.toChunkReversed() || Chunk.empty()
            )
            exit = TExit.die(current.defect(), annotation)
            break
          }
          case OpCodes.OP_FAIL: {
            this.logTrace(curr.trace)
            const annotation = new StackAnnotation(
              this.stackToLines(),
              this.execution?.toChunkReversed() || Chunk.empty()
            )
            const cont = this.nextFailure()
            if (cont === undefined) {
              exit = TExit.fail(current.error(), annotation)
            } else {
              this.logTrace(cont.trace)
              curr = cont.failK(current.error()) as Primitive
            }
            break
          }
          case OpCodes.OP_RETRY: {
            this.logTrace(curr.trace)
            const cont = this.nextRetry()
            if (cont === undefined) {
              exit = TExit.retry
            } else {
              this.logTrace(cont.trace)
              curr = cont.retryK() as Primitive
            }
            break
          }
          case OpCodes.OP_INTERRUPT: {
            this.logTrace(curr.trace)
            const annotation = new StackAnnotation(
              this.stackToLines(),
              this.execution?.toChunkReversed() || Chunk.empty()
            )
            exit = TExit.interrupt(this.fiberId, annotation)
            break
          }
          case OpCodes.OP_WITH_STM_RUNTIME: {
            this.logTrace(current.trace)
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
            this.logTrace(current.trace)
            const env = this.env
            this.env = current.provide(env)
            curr = pipe(
              current.stm,
              ensuring(sync(() => (this.env = env)))
            ) as Primitive
            break
          }
          case OpCodes.OP_SUCCEED: {
            this.logTrace(current.trace)
            const value = current.value
            const cont = this.nextSuccess()
            if (cont === undefined) {
              exit = TExit.succeed(value)
            } else {
              this.logTrace(cont.trace)
              curr = cont.successK(value) as Primitive
            }
            break
          }
          case OpCodes.OP_SYNC: {
            this.logTrace(current.trace)
            const value = current.evaluate()
            const cont = this.nextSuccess()
            if (cont === undefined) {
              exit = TExit.succeed(value)
            } else {
              this.logTrace(cont.trace)
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
 * @macro traced
 * @internal
 */
export const catchAll = <E, R1, E1, B>(f: (e: E) => STM.STM<R1, E1, B>) => {
  const trace = getCallTrace()
  return <R, A>(self: STM.STM<R, E, A>): STM.STM<R | R1, E1, A | B> => {
    const stm = Object.create(proto)
    stm.opSTM = OpCodes.OP_ON_FAILURE
    stm.first = self
    stm.failK = f
    stm.trace = trace
    return stm
  }
}

/**
 * @macro traced
 * @internal
 */
export const die = (defect: unknown): STM.STM<never, never, never> => {
  const trace = getCallTrace()
  return dieSync(() => defect).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const dieMessage = (message: string): STM.STM<never, never, never> => {
  const trace = getCallTrace()
  return dieSync(() => Cause.RuntimeException(message)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const dieSync = (evaluate: LazyArg<unknown>): STM.STM<never, never, never> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_DIE
  stm.defect = evaluate
  stm.trace = trace
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const effect = <R, A>(
  f: (
    journal: Journal.Journal,
    fiberId: FiberId.FiberId,
    environment: Context.Context<R>
  ) => A
): STM.STM<R, never, A> => {
  const trace = getCallTrace()
  return withSTMRuntime((_) => succeed(f(_.journal, _.fiberId, _.getEnv()))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const ensuring = <R1, B>(finalizer: STM.STM<R1, never, B>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R1, E, A> =>
    pipe(
      self,
      foldSTM(
        (e) => pipe(finalizer, zipRight(fail(e))),
        (a) => pipe(finalizer, zipRight(succeed(a)))
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fail = <E>(error: E): STM.STM<never, E, never> => {
  const trace = getCallTrace()
  return failSync(() => error).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const failSync = <E>(evaluate: LazyArg<E>): STM.STM<never, E, never> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_FAIL
  stm.error = evaluate
  stm.trace = trace
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const flatMap = <A, R1, E1, A2>(f: (a: A) => STM.STM<R1, E1, A2>) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R1 | R, E | E1, A2> => {
    const stm = Object.create(proto)
    stm.opSTM = OpCodes.OP_ON_SUCCESS
    stm.first = self
    stm.successK = f
    stm.trace = trace
    return stm
  }
}

/**
 * @macro traced
 * @internal
 */
export const foldSTM = <E, R1, E1, A1, A, R2, E2, A2>(
  onFailure: (e: E) => STM.STM<R1, E1, A1>,
  onSuccess: (a: A) => STM.STM<R2, E2, A2>
) => {
  const trace = getCallTrace()
  return <R>(self: STM.STM<R, E, A>): STM.STM<R | R1 | R2, E1 | E2, A1 | A2> => {
    return pipe(
      self,
      map(Either.right),
      catchAll((e) => pipe(onFailure(e), map(Either.left))),
      flatMap((either): STM.STM<R | R1 | R2, E1 | E2, A1 | A2> => {
        switch (either._tag) {
          case "Left": {
            return succeed(either.left)
          }
          case "Right": {
            return onSuccess(either.right)
          }
        }
      })
    ).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const interrupt = (): STM.STM<never, never, never> => {
  const trace = getCallTrace()
  return withSTMRuntime((_) => {
    const stm = Object.create(proto)
    stm.opSTM = OpCodes.OP_INTERRUPT
    stm.trace = trace
    stm.fiberId = _.fiberId
    return stm
  })
}

/**
 * @macro traced
 * @internal
 */
export const interruptWith = (fiberId: FiberId.FiberId): STM.STM<never, never, never> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_INTERRUPT
  stm.trace = trace
  stm.fiberId = fiberId
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const map = <A, B>(f: (a: A) => B) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R, E, B> => {
    return pipe(self, flatMap((a) => sync(() => f(a)))).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const orTry = <R1, E1, A1>(that: () => STM.STM<R1, E1, A1>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R1, E | E1, A | A1> => {
    const stm = Object.create(proto)
    stm.opSTM = OpCodes.OP_ON_RETRY
    stm.first = self
    stm.retryK = that
    stm.trace = trace
    return stm
  }
}

/**
 * @macro traced
 * @internal
 */
export const retry = (): STM.STM<never, never, never> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_RETRY
  stm.trace = trace
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const succeed = <A>(value: A): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_SUCCEED
  stm.value = value
  stm.trace = trace
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const sync = <A>(evaluate: () => A): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_SYNC
  stm.evaluate = evaluate
  stm.trace = trace
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const provideSomeEnvironment = <R0, R>(f: (context: Context.Context<R0>) => Context.Context<R>) => {
  const trace = getCallTrace()
  return <E, A>(self: STM.STM<R, E, A>): STM.STM<R0, E, A> => {
    const stm = Object.create(proto)
    stm.opSTM = OpCodes.OP_PROVIDE
    stm.stm = self
    stm.provide = f
    stm.trace = trace
    return stm
  }
}

/**
 * @macro traced
 * @internal
 */
export const withSTMRuntime = <R, E, A>(
  f: (runtime: STMDriver<unknown, unknown, unknown>) => STM.STM<R, E, A>
): STM.STM<R, E, A> => {
  const trace = getCallTrace()
  const stm = Object.create(proto)
  stm.opSTM = OpCodes.OP_WITH_STM_RUNTIME
  stm.evaluate = f
  stm.trace = trace
  return stm
}

/**
 * @macro traced
 * @internal
 */
export const zip = <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R1, E | E1, readonly [A, A1]> => {
    return pipe(self, zipWith(that, (a, a1) => [a, a1] as const)).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const zipLeft = <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R1, E | E1, A> => {
    return pipe(self, flatMap((a) => pipe(that, map(() => a)))).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const zipRight = <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: STM.STM<R, E, A>): STM.STM<R | R1, E | E1, A1> => {
    return pipe(self, flatMap(() => that)).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const zipWith = <R1, E1, A1, A, A2>(that: STM.STM<R1, E1, A1>, f: (a: A, b: A1) => A2) => {
  const trace = getCallTrace()
  return <R, E>(self: STM.STM<R, E, A>): STM.STM<R1 | R, E | E1, A2> => {
    return pipe(self, flatMap((a) => pipe(that, map((b) => f(a, b))))).traced(trace)
  }
}
