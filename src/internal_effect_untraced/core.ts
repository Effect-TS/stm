import * as Chunk from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import * as Either from "@effect/data/Either"
import * as Equal from "@effect/data/Equal"
import type { LazyArg } from "@effect/data/Function"
import { constVoid, pipe } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import * as MRef from "@effect/data/MutableRef"
import type * as Option from "@effect/data/Option"
import { tuple } from "@effect/data/ReadonlyArray"
import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import type * as FiberId from "@effect/io/Fiber/Id"
import * as FiberRef from "@effect/io/FiberRef"
import * as internalCause from "@effect/io/internal_effect_untraced/cause"
import { withFiberRuntime } from "@effect/io/internal_effect_untraced/core"
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
  readonly i0: Tag
}

/** @internal */
interface STMEffect extends
  Op<OpCodes.OP_WITH_STM_RUNTIME, {
    readonly i1: (
      runtime: STMDriver<unknown, unknown, unknown>
    ) => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMOnFailure extends
  Op<OpCodes.OP_ON_FAILURE, {
    readonly i1: STM.STM<unknown, unknown, unknown>
    readonly i2: (error: unknown) => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMOnRetry extends
  Op<OpCodes.OP_ON_RETRY, {
    readonly i1: STM.STM<unknown, unknown, unknown>
    readonly i2: () => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMOnSuccess extends
  Op<OpCodes.OP_ON_SUCCESS, {
    readonly i1: STM.STM<unknown, unknown, unknown>
    readonly i2: (a: unknown) => STM.STM<unknown, unknown, unknown>
  }>
{}

/** @internal */
interface STMProvide extends
  Op<OpCodes.OP_PROVIDE, {
    readonly i1: STM.STM<unknown, unknown, unknown>
    readonly i2: (context: Context.Context<unknown>) => Context.Context<unknown>
  }>
{}

/** @internal */
interface STMSync extends
  Op<OpCodes.OP_SYNC, {
    readonly i1: () => unknown
  }>
{}

/** @internal */
interface STMSucceed extends
  Op<OpCodes.OP_SUCCEED, {
    readonly i1: unknown
  }>
{}

/** @internal */
interface STMRetry extends Op<OpCodes.OP_RETRY, {}> {}

/** @internal */
interface STMFail extends
  Op<OpCodes.OP_FAIL, {
    readonly i1: LazyArg<unknown>
  }>
{}

/** @internal */
interface STMDie extends
  Op<OpCodes.OP_DIE, {
    readonly i1: LazyArg<unknown>
  }>
{}

/** @internal */
interface STMTraced extends
  Op<OpCodes.OP_TRACED, {
    readonly i1: STM.STM<unknown, unknown, unknown>
    readonly trace: Debug.Trace
  }>
{}

/** @internal */
interface STMInterrupt extends
  Op<OpCodes.OP_INTERRUPT, {
    readonly i1: FiberId.Runtime
  }>
{}

/** @internal */
const stmVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
class STMPrimitive implements STM.STM<any, any, any> {
  public _tag = OP_COMMIT
  public i1: any = undefined
  public i2: any = undefined
  public trace: Debug.Trace = undefined;
  [Effect.EffectTypeId] = stmVariance
  get [STMTypeId]() {
    return stmVariance
  }
  constructor(readonly i0: Primitive["i0"]) {}
  [Equal.symbol](this: {}, that: unknown) {
    return this === that
  }
  [Hash.symbol](this: {}) {
    return Hash.random(this)
  }
  commit(this: STM.STM<any, any, any>): Effect.Effect<any, any, any> {
    return Debug.untraced(() => commit(this))
  }
  traced(this: STM.STM<any, any, any>, trace: Debug.Trace): STM.STM<any, any, any> {
    if (trace) {
      const effect = new STMPrimitive(OpCodes.OP_TRACED) as any
      effect.i1 = this
      effect.trace = trace
      return effect
    }
    return this
  }
}

/** @internal */
export const isSTM = (u: unknown): u is STM.STM<unknown, unknown, unknown> =>
  typeof u === "object" && u != null && STMTypeId in u || Context.isGenericTag(u)

/** @internal */
export const commit = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: STM.STM<R, E, A>): Effect.Effect<R, E, A> =>
    unsafeAtomically(self, constVoid, constVoid).traced(trace)
)

/** @internal */
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
export const context = Debug.methodWithTrace((trace) =>
  <R>(): STM.STM<R, never, Context.Context<R>> => effect<R, Context.Context<R>>((_, __, env) => env).traced(trace)
)

/** @internal */
export const contextWith = Debug.methodWithTrace((trace, restore) =>
  <R0, R>(f: (environment: Context.Context<R0>) => R): STM.STM<R0, never, R> =>
    map(context<R0>(), restore(f)).traced(trace)
)

/** @internal */
export const contextWithSTM = Debug.methodWithTrace((trace, restore) =>
  <R0, R, E, A>(
    f: (environment: Context.Context<R0>) => STM.STM<R, E, A>
  ): STM.STM<R0 | R, E, A> => flatMap(context<R0>(), restore(f)).traced(trace)
)

/** @internal */
export class STMDriver<R, E, A> {
  private contStack: Array<Continuation> = []
  private env: Context.Context<unknown>
  private traceStack: Array<Debug.SourceLocation> = []

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

  stackToLines(): Chunk.Chunk<Debug.SourceLocation> {
    if (this.traceStack.length === 0) {
      return Chunk.empty()
    }
    const lines: Array<Debug.SourceLocation> = []
    let current = this.traceStack.length - 1
    while (current >= 0 && lines.length < Debug.runtimeDebug.traceStackLimit) {
      const value = this.traceStack[current]!
      lines.push(value)
      current = current - 1
    }
    return Chunk.unsafeFromArray(lines)
  }

  nextSuccess() {
    let current = this.popStack()
    while (current !== undefined && current.i0 !== OpCodes.OP_ON_SUCCESS) {
      current = this.popStack()
    }
    return current
  }

  nextFailure() {
    let current = this.popStack()
    while (current !== undefined && current.i0 !== OpCodes.OP_ON_FAILURE) {
      current = this.popStack()
    }
    return current
  }

  nextRetry() {
    let current = this.popStack()
    while (current !== undefined && current.i0 !== OpCodes.OP_ON_RETRY) {
      current = this.popStack()
    }
    return current
  }

  run(): TExit.TExit<E, A> {
    let curr = this.self as Primitive | Context.GenericTag | Either.Either<any, any> | Option.Option<any> | undefined
    let exit: TExit.TExit<unknown, unknown> | undefined = undefined
    while (exit === undefined && curr !== undefined) {
      try {
        const current = curr
        if (current) {
          switch (current._tag) {
            case "Tag": {
              curr = effect((_, __, env) => Context.unsafeGet(env, current)) as Primitive
              break
            }
            case "Traced": {
              if (current.trace) {
                const stm = new STMPrimitive(OpCodes.OP_TRACED)
                stm.i1 = current.i0
                stm.trace = current.trace
                curr = stm as any
              } else {
                curr = current.i0
              }
              break
            }
            case "Left": {
              curr = fail((current as any)["i0"]) as Primitive
              break
            }
            case "None": {
              curr = fail(Cause.NoSuchElementException()) as Primitive
              break
            }
            case "Right": {
              curr = succeed((current as any)["i0"]) as Primitive
              break
            }
            case "Some": {
              curr = succeed((current as any)["i0"]) as Primitive
              break
            }
            case "Commit": {
              switch (current.i0) {
                case OpCodes.OP_TRACED: {
                  this.pushStack(current)
                  curr = current.i1 as Primitive
                  break
                }
                case OpCodes.OP_DIE: {
                  const annotation = new Cause.StackAnnotation(
                    this.stackToLines(),
                    MRef.incrementAndGet(Cause.globalErrorSeq)
                  )
                  exit = TExit.die(current.i1(), annotation)
                  break
                }
                case OpCodes.OP_FAIL: {
                  const annotation = new internalCause.StackAnnotation(
                    this.stackToLines(),
                    MRef.incrementAndGet(Cause.globalErrorSeq)
                  )
                  const cont = this.nextFailure()
                  if (cont === undefined) {
                    exit = TExit.fail(current.i1(), annotation)
                  } else {
                    curr = cont.i2(current.i1()) as Primitive
                  }
                  break
                }
                case OpCodes.OP_RETRY: {
                  const cont = this.nextRetry()
                  if (cont === undefined) {
                    exit = TExit.retry
                  } else {
                    curr = cont.i2() as Primitive
                  }
                  break
                }
                case OpCodes.OP_INTERRUPT: {
                  const annotation = new Cause.StackAnnotation(
                    this.stackToLines(),
                    MRef.incrementAndGet(Cause.globalErrorSeq)
                  )
                  exit = TExit.interrupt(this.fiberId, annotation)
                  break
                }
                case OpCodes.OP_WITH_STM_RUNTIME: {
                  curr = current.i1(this as STMDriver<unknown, unknown, unknown>) as Primitive
                  break
                }
                case OpCodes.OP_ON_SUCCESS:
                case OpCodes.OP_ON_FAILURE:
                case OpCodes.OP_ON_RETRY: {
                  this.pushStack(current)
                  curr = current.i1 as Primitive
                  break
                }
                case OpCodes.OP_PROVIDE: {
                  const env = this.env
                  this.env = current.i2(env)
                  curr = pipe(
                    current.i1,
                    ensuring(sync(() => (this.env = env)))
                  ) as Primitive
                  break
                }
                case OpCodes.OP_SUCCEED: {
                  const value = current.i1
                  const cont = this.nextSuccess()
                  if (cont === undefined) {
                    exit = TExit.succeed(value)
                  } else {
                    curr = cont.i2(value) as Primitive
                  }
                  break
                }
                case OpCodes.OP_SYNC: {
                  const value = current.i1()
                  const cont = this.nextSuccess()
                  if (cont === undefined) {
                    exit = TExit.succeed(value)
                  } else {
                    curr = cont.i2(value) as Primitive
                  }
                  break
                }
              }
              break
            }
          }
        }
      } catch (e) {
        curr = die(e) as Primitive
      }
    }
    return exit as TExit.TExit<E, A>
  }
}

/** @internal */
export const catchAll = Debug.dualWithTrace<
  <E, R1, E1, B>(
    f: (e: E) => STM.STM<R1, E1, B>
  ) => <R, A>(
    self: STM.STM<R, E, A>
  ) => STM.STM<R1 | R, E1, B | A>,
  <R, A, E, R1, E1, B>(
    self: STM.STM<R, E, A>,
    f: (e: E) => STM.STM<R1, E1, B>
  ) => STM.STM<R1 | R, E1, B | A>
>(2, (trace, restore) =>
  (self, f) => {
    const stm = new STMPrimitive(OpCodes.OP_ON_FAILURE)
    stm.i1 = self
    stm.i2 = restore(f)
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/** @internal */
export const contramapContext = Debug.dualWithTrace<
  <R0, R>(
    f: (context: Context.Context<R0>) => Context.Context<R>
  ) => <E, A>(
    self: STM.STM<R, E, A>
  ) => STM.STM<R0, E, A>,
  <E, A, R0, R>(
    self: STM.STM<R, E, A>,
    f: (context: Context.Context<R0>) => Context.Context<R>
  ) => STM.STM<R0, E, A>
>(2, (trace, restore) =>
  (self, f) => {
    const stm = new STMPrimitive(OpCodes.OP_PROVIDE)
    stm.i1 = self
    stm.i2 = restore(f)
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/** @internal */
export const die = Debug.methodWithTrace((trace) =>
  (defect: unknown): STM.STM<never, never, never> => dieSync(() => defect).traced(trace)
)

/** @internal */
export const dieMessage = Debug.methodWithTrace((trace) =>
  (message: string): STM.STM<never, never, never> => dieSync(() => Cause.RuntimeException(message)).traced(trace)
)

/** @internal */
export const dieSync = Debug.methodWithTrace((trace, restore) =>
  (evaluate: LazyArg<unknown>): STM.STM<never, never, never> => {
    const stm = new STMPrimitive(OpCodes.OP_DIE)
    stm.i1 = restore(evaluate)
    if (trace) {
      return stm.traced(trace) as any
    }
    return stm as any
  }
)

/** @internal */
export const effect = Debug.methodWithTrace((trace, restore) =>
  <R, A>(
    f: (journal: Journal.Journal, fiberId: FiberId.FiberId, environment: Context.Context<R>) => A
  ): STM.STM<R, never, A> => withSTMRuntime((_) => succeed(restore(f)(_.journal, _.fiberId, _.getEnv()))).traced(trace)
)

/** @internal */
export const ensuring = Debug.dualWithTrace<
  <R1, B>(finalizer: STM.STM<R1, never, B>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E, A>,
  <R, E, A, R1, B>(self: STM.STM<R, E, A>, finalizer: STM.STM<R1, never, B>) => STM.STM<R1 | R, E, A>
>(2, (trace) =>
  (self, finalizer) =>
    matchSTM(
      self,
      (e) => zipRight(finalizer, fail(e)),
      (a) => zipRight(finalizer, succeed(a))
    ).traced(trace))

/** @internal */
export const fail = Debug.methodWithTrace((trace) =>
  <E>(error: E): STM.STM<never, E, never> => failSync(() => error).traced(trace)
)

/** @internal */
export const failSync = Debug.methodWithTrace((trace, restore) =>
  <E>(evaluate: LazyArg<E>): STM.STM<never, E, never> => {
    const stm = new STMPrimitive(OpCodes.OP_FAIL)
    stm.i1 = restore(evaluate)
    if (trace) {
      return stm.traced(trace) as any
    }
    return stm as any
  }
)

/** @internal */
export const flatMap = Debug.dualWithTrace<
  <A, R1, E1, A2>(f: (a: A) => STM.STM<R1, E1, A2>) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A2>,
  <R, E, A, R1, E1, A2>(self: STM.STM<R, E, A>, f: (a: A) => STM.STM<R1, E1, A2>) => STM.STM<R1 | R, E1 | E, A2>
>(2, (trace, restore) =>
  (self, f) => {
    const stm = new STMPrimitive(OpCodes.OP_ON_SUCCESS)
    stm.i1 = self
    stm.i2 = restore(f)
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/** @internal */
export const matchSTM = Debug.dualWithTrace<
  <E, R1, E1, A1, A, R2, E2, A2>(
    onFailure: (e: E) => STM.STM<R1, E1, A1>,
    onSuccess: (a: A) => STM.STM<R2, E2, A2>
  ) => <R>(self: STM.STM<R, E, A>) => STM.STM<R1 | R2 | R, E1 | E2, A1 | A2>,
  <R, E, R1, E1, A1, A, R2, E2, A2>(
    self: STM.STM<R, E, A>,
    onFailure: (e: E) => STM.STM<R1, E1, A1>,
    onSuccess: (a: A) => STM.STM<R2, E2, A2>
  ) => STM.STM<R1 | R2 | R, E1 | E2, A1 | A2>
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

/** @internal */
export const interrupt = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, never> =>
    withSTMRuntime((_) => {
      const stm = new STMPrimitive(OpCodes.OP_INTERRUPT)
      stm.i1 = _.fiberId
      if (trace) {
        return stm.traced(trace) as any
      }
      return stm as any
    })
)

/** @internal */
export const interruptAs = Debug.methodWithTrace((trace) =>
  (fiberId: FiberId.FiberId): STM.STM<never, never, never> => {
    const stm = new STMPrimitive(OpCodes.OP_INTERRUPT)
    stm.i1 = fiberId
    stm.trace = void 0
    if (trace) {
      return stm.traced(trace) as any
    }
    return stm as any
  }
)

/** @internal */
export const map = Debug.dualWithTrace<
  <A, B>(f: (a: A) => B) => <R, E>(self: STM.STM<R, E, A>) => STM.STM<R, E, B>,
  <R, E, A, B>(self: STM.STM<R, E, A>, f: (a: A) => B) => STM.STM<R, E, B>
>(2, (trace, resume) => (self, f) => pipe(self, flatMap((a) => sync(() => resume(f)(a)))).traced(trace))

/** @internal */
export const orTry = Debug.dualWithTrace<
  <R1, E1, A1>(
    that: LazyArg<STM.STM<R1, E1, A1>>
  ) => <R, E, A>(
    self: STM.STM<R, E, A>
  ) => STM.STM<R1 | R, E1 | E, A1 | A>,
  <R, E, A, R1, E1, A1>(
    self: STM.STM<R, E, A>,
    that: LazyArg<STM.STM<R1, E1, A1>>
  ) => STM.STM<R1 | R, E1 | E, A1 | A>
>(2, (trace, restore) =>
  (self, that) => {
    const stm = new STMPrimitive(OpCodes.OP_ON_RETRY)
    stm.i1 = self
    stm.i2 = restore(that)
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  })

/** @internal */
export const retry = Debug.methodWithTrace((trace) =>
  (): STM.STM<never, never, never> => {
    const stm = new STMPrimitive(OpCodes.OP_RETRY)
    if (trace) {
      return stm.traced(trace) as any
    }
    return stm as any
  }
)

/** @internal */
export const succeed = Debug.methodWithTrace((trace) =>
  <A>(value: A): STM.STM<never, never, A> => {
    const stm = new STMPrimitive(OpCodes.OP_SUCCEED)
    stm.i1 = value
    if (trace) {
      return stm.traced(trace) as any
    }
    return stm as any
  }
)

/** @internal */
export const sync = Debug.methodWithTrace((trace, restore) =>
  <A>(evaluate: () => A): STM.STM<never, never, A> => {
    const stm = new STMPrimitive(OpCodes.OP_SYNC)
    stm.i1 = restore(evaluate)
    if (trace) {
      return stm.traced(trace) as any
    }
    return stm as any
  }
)

/** @internal */
export const withSTMRuntime = Debug.methodWithTrace((trace, restore) =>
  <R, E, A>(
    f: (runtime: STMDriver<unknown, unknown, unknown>) => STM.STM<R, E, A>
  ): STM.STM<R, E, A> => {
    const stm = new STMPrimitive(OpCodes.OP_WITH_STM_RUNTIME)
    stm.i1 = restore(f)
    if (trace) {
      return stm.traced(trace)
    }
    return stm
  }
)

/** @internal */
export const zip = Debug.dualWithTrace<
  <R1, E1, A1>(
    that: STM.STM<R1, E1, A1>
  ) => <R, E, A>(
    self: STM.STM<R, E, A>
  ) => STM.STM<R1 | R, E1 | E, [A, A1]>,
  <R, E, A, R1, E1, A1>(
    self: STM.STM<R, E, A>,
    that: STM.STM<R1, E1, A1>
  ) => STM.STM<R1 | R, E1 | E, [A, A1]>
>(2, (trace) => (self, that) => pipe(self, zipWith(that, (a, a1) => tuple(a, a1))).traced(trace))

/** @internal */
export const zipLeft = Debug.dualWithTrace<
  <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A>,
  <R, E, A, R1, E1, A1>(self: STM.STM<R, E, A>, that: STM.STM<R1, E1, A1>) => STM.STM<R1 | R, E1 | E, A>
>(2, (trace) => (self, that) => pipe(self, flatMap((a) => pipe(that, map(() => a)))).traced(trace))

/** @internal */
export const zipRight = Debug.dualWithTrace<
  <R1, E1, A1>(that: STM.STM<R1, E1, A1>) => <R, E, A>(self: STM.STM<R, E, A>) => STM.STM<R1 | R, E1 | E, A1>,
  <R, E, A, R1, E1, A1>(self: STM.STM<R, E, A>, that: STM.STM<R1, E1, A1>) => STM.STM<R1 | R, E1 | E, A1>
>(2, (trace) => (self, that) => pipe(self, flatMap(() => that)).traced(trace))

/** @internal */
export const zipWith = Debug.dualWithTrace<
  <R1, E1, A1, A, A2>(
    that: STM.STM<R1, E1, A1>,
    f: (a: A, b: A1) => A2
  ) => <R, E>(
    self: STM.STM<R, E, A>
  ) => STM.STM<R1 | R, E1 | E, A2>,
  <R, E, R1, E1, A1, A, A2>(
    self: STM.STM<R, E, A>,
    that: STM.STM<R1, E1, A1>,
    f: (a: A, b: A1) => A2
  ) => STM.STM<R1 | R, E1 | E, A2>
>(
  3,
  (trace, restore) =>
    (self, that, f) => pipe(self, flatMap((a) => pipe(that, map((b) => restore(f)(a, b))))).traced(trace)
)
