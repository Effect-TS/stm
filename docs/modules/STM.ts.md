---
title: STM.ts
nav_order: 1
parent: Modules
---

## STM overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [acquireUseRelease](#acquireuserelease)
  - [attempt](#attempt)
  - [check](#check)
  - [collectAll](#collectall)
  - [collectAllDiscard](#collectalldiscard)
  - [collectFirst](#collectfirst)
  - [cond](#cond)
  - [die](#die)
  - [dieMessage](#diemessage)
  - [dieSync](#diesync)
  - [environment](#environment)
  - [environmentWith](#environmentwith)
  - [environmentWithSTM](#environmentwithstm)
  - [every](#every)
  - [exists](#exists)
  - [fail](#fail)
  - [failSync](#failsync)
  - [fiberId](#fiberid)
  - [filter](#filter)
  - [filterNot](#filternot)
  - [fromEither](#fromeither)
  - [fromOption](#fromoption)
  - [interrupt](#interrupt)
  - [interruptWith](#interruptwith)
  - [iterate](#iterate)
  - [loop](#loop)
  - [loopDiscard](#loopdiscard)
  - [mergeAll](#mergeall)
  - [reduce](#reduce)
  - [reduceAll](#reduceall)
  - [reduceRight](#reduceright)
  - [replicate](#replicate)
  - [replicateSTM](#replicatestm)
  - [replicateSTMDiscard](#replicatestmdiscard)
  - [service](#service)
  - [serviceWith](#servicewith)
  - [serviceWithSTM](#servicewithstm)
  - [succeed](#succeed)
  - [succeedLeft](#succeedleft)
  - [succeedNone](#succeednone)
  - [succeedRight](#succeedright)
  - [succeedSome](#succeedsome)
  - [suspend](#suspend)
  - [sync](#sync)
  - [tryCatch](#trycatch)
  - [unit](#unit)
- [destructors](#destructors)
  - [commit](#commit)
  - [commitEither](#commiteither)
- [environment](#environment-1)
  - [provideEnvironment](#provideenvironment)
  - [provideSomeEnvironment](#providesomeenvironment)
- [error handling](#error-handling)
  - [catchAll](#catchall)
  - [catchSome](#catchsome)
  - [orDie](#ordie)
  - [orDieWith](#ordiewith)
  - [orElse](#orelse)
  - [orElseEither](#orelseeither)
  - [orElseFail](#orelsefail)
  - [orElseOptional](#orelseoptional)
  - [orElseSucceed](#orelsesucceed)
  - [orTry](#ortry)
  - [retry](#retry)
- [filtering](#filtering)
  - [filterOrDie](#filterordie)
  - [filterOrDieMessage](#filterordiemessage)
  - [filterOrElse](#filterorelse)
  - [filterOrElseWith](#filterorelsewith)
  - [filterOrFail](#filterorfail)
- [finalization](#finalization)
  - [ensuring](#ensuring)
- [folding](#folding)
  - [fold](#fold)
  - [foldSTM](#foldstm)
- [getters](#getters)
  - [head](#head)
  - [isFailure](#isfailure)
  - [isSuccess](#issuccess)
  - [left](#left)
  - [right](#right)
  - [some](#some)
  - [someOrElse](#someorelse)
  - [someOrElseSTM](#someorelsestm)
  - [someOrFail](#someorfail)
  - [someOrFailException](#someorfailexception)
  - [unleft](#unleft)
  - [unright](#unright)
  - [unsome](#unsome)
- [mapping](#mapping)
  - [as](#as)
  - [asSome](#assome)
  - [asSomeError](#assomeerror)
  - [map](#map)
  - [mapAttempt](#mapattempt)
  - [mapBoth](#mapboth)
  - [mapError](#maperror)
- [models](#models)
  - [STM (interface)](#stm-interface)
- [mutations](#mutations)
  - [absolve](#absolve)
  - [collect](#collect)
  - [collectSTM](#collectstm)
  - [either](#either)
  - [eventually](#eventually)
  - [flip](#flip)
  - [flipWith](#flipwith)
  - [ifSTM](#ifstm)
  - [ignore](#ignore)
  - [merge](#merge)
  - [negate](#negate)
  - [none](#none)
  - [option](#option)
  - [refineOrDie](#refineordie)
  - [refineOrDieWith](#refineordiewith)
  - [reject](#reject)
  - [rejectSTM](#rejectstm)
  - [repeatUntil](#repeatuntil)
  - [repeatWhile](#repeatwhile)
  - [retryUntil](#retryuntil)
  - [retryWhile](#retrywhile)
  - [summarized](#summarized)
  - [unless](#unless)
  - [unlessSTM](#unlessstm)
  - [validateAll](#validateall)
  - [validateFirst](#validatefirst)
  - [when](#when)
  - [whenCase](#whencase)
  - [whenCaseSTM](#whencasestm)
  - [whenSTM](#whenstm)
- [sequencing](#sequencing)
  - [flatMap](#flatmap)
  - [flatMapError](#flatmaperror)
  - [flatten](#flatten)
  - [flattenErrorOption](#flattenerroroption)
  - [tap](#tap)
  - [tapBoth](#tapboth)
  - [tapError](#taperror)
- [symbols](#symbols)
  - [STMTypeId](#stmtypeid)
  - [STMTypeId (type alias)](#stmtypeid-type-alias)
- [traversing](#traversing)
  - [forEach](#foreach)
  - [forEachDiscard](#foreachdiscard)
  - [partition](#partition)
- [zipping](#zipping)
  - [zip](#zip)
  - [zipLeft](#zipleft)
  - [zipRight](#zipright)
  - [zipWith](#zipwith)

---

# constructors

## acquireUseRelease

Treats the specified `acquire` transaction as the acquisition of a
resource. The `acquire` transaction will be executed interruptibly. If it
is a success and is committed the specified `release` workflow will be
executed uninterruptibly as soon as the `use` workflow completes execution.

**Signature**

```ts
export declare const acquireUseRelease: <R, E, A, R2, E2, A2, R3, E3, A3>(
  acquire: STM<R, E, A>,
  use: (resource: A) => STM<R2, E2, A2>,
  release: (resource: A) => STM<R3, E3, A3>
) => Effect.Effect<R | R2 | R3, E | E2 | E3, A2>
```

Added in v1.0.0

## attempt

Creates an `STM` value from a partial (but pure) function.

**Signature**

```ts
export declare const attempt: <A>(evaluate: LazyArg<A>) => STM<never, unknown, A>
```

Added in v1.0.0

## check

Checks the condition, and if it's true, returns unit, otherwise, retries.

**Signature**

```ts
export declare const check: (predicate: LazyArg<boolean>) => STM<never, never, void>
```

Added in v1.0.0

## collectAll

Collects all the transactional effects in a collection, returning a single
transactional effect that produces a collection of values.

**Signature**

```ts
export declare const collectAll: <R, E, A>(iterable: Iterable<STM<R, E, A>>) => STM<R, E, Chunk.Chunk<A>>
```

Added in v1.0.0

## collectAllDiscard

Collects all the transactional effects, returning a single transactional
effect that produces `Unit`.

Equivalent to `pipe(icollectAll(iterable), asUnit)`, but without the cost
of building the list of results.

**Signature**

```ts
export declare const collectAllDiscard: <R, E, A>(iterable: Iterable<STM<R, E, A>>) => STM<R, E, void>
```

Added in v1.0.0

## collectFirst

Collects the first element of the `Iterable<A>` for which the effectual
function `f` returns `Some`.

**Signature**

```ts
export declare const collectFirst: <A, R, E, A2>(
  pf: (a: A) => STM<R, E, Option.Option<A2>>
) => (iterable: Iterable<A>) => STM<R, E, Option.Option<A2>>
```

Added in v1.0.0

## cond

Similar to Either.cond, evaluate the predicate, return the given A as
success if predicate returns true, and the given E as error otherwise

**Signature**

```ts
export declare const cond: <E, A>(
  predicate: LazyArg<boolean>,
  error: LazyArg<E>,
  result: LazyArg<A>
) => STM<never, E, A>
```

Added in v1.0.0

## die

Fails the transactional effect with the specified defect.

**Signature**

```ts
export declare const die: (defect: unknown) => STM<never, never, never>
```

Added in v1.0.0

## dieMessage

Kills the fiber running the effect with a `Cause.RuntimeException` that
contains the specified message.

**Signature**

```ts
export declare const dieMessage: (message: string) => STM<never, never, never>
```

Added in v1.0.0

## dieSync

Fails the transactional effect with the specified lazily evaluated defect.

**Signature**

```ts
export declare const dieSync: (evaluate: LazyArg<unknown>) => STM<never, never, never>
```

Added in v1.0.0

## environment

Retrieves the environment inside an stm.

**Signature**

```ts
export declare const environment: <R>() => STM<R, never, Context.Context<R>>
```

Added in v1.0.0

## environmentWith

Accesses the environment of the transaction to perform a transaction.

**Signature**

```ts
export declare const environmentWith: <R0, R>(f: (environment: Context.Context<R0>) => R) => STM<R0, never, R>
```

Added in v1.0.0

## environmentWithSTM

Accesses the environment of the transaction to perform a transaction.

**Signature**

```ts
export declare const environmentWithSTM: <R0, R, E, A>(
  f: (environment: Context.Context<R0>) => STM<R, E, A>
) => STM<R0 | R, E, A>
```

Added in v1.0.0

## every

Determines whether all elements of the `Iterable<A>` satisfy the effectual
predicate.

**Signature**

```ts
export declare const every: <A, R, E>(
  predicate: (a: A) => STM<R, E, boolean>
) => (iterable: Iterable<A>) => STM<R, E, boolean>
```

Added in v1.0.0

## exists

Determines whether any element of the `Iterable[A]` satisfies the effectual
predicate `f`.

**Signature**

```ts
export declare const exists: <A, R, E>(
  predicate: (a: A) => STM<R, E, boolean>
) => (iterable: Iterable<A>) => STM<R, E, boolean>
```

Added in v1.0.0

## fail

Fails the transactional effect with the specified error.

**Signature**

```ts
export declare const fail: <E>(error: E) => STM<never, E, never>
```

Added in v1.0.0

## failSync

Fails the transactional effect with the specified lazily evaluated error.

**Signature**

```ts
export declare const failSync: <E>(evaluate: LazyArg<E>) => STM<never, E, never>
```

Added in v1.0.0

## fiberId

Returns the fiber id of the fiber committing the transaction.

**Signature**

```ts
export declare const fiberId: () => STM<never, never, FiberId.FiberId>
```

Added in v1.0.0

## filter

Filters the collection using the specified effectual predicate.

**Signature**

```ts
export declare const filter: <A, R, E>(
  predicate: (a: A) => STM<R, E, boolean>
) => (iterable: Iterable<A>) => STM<R, E, Chunk.Chunk<A>>
```

Added in v1.0.0

## filterNot

Filters the collection using the specified effectual predicate, removing
all elements that satisfy the predicate.

**Signature**

```ts
export declare const filterNot: <A, R, E>(
  predicate: (a: A) => STM<R, E, boolean>
) => (iterable: Iterable<A>) => STM<R, E, Chunk.Chunk<A>>
```

Added in v1.0.0

## fromEither

Lifts an `Either` into a `STM`.

**Signature**

```ts
export declare const fromEither: <E, A>(either: Either.Either<E, A>) => STM<never, E, A>
```

Added in v1.0.0

## fromOption

Lifts an `Option` into a `STM`.

**Signature**

```ts
export declare const fromOption: <A>(option: Option.Option<A>) => STM<never, Option.Option<never>, A>
```

Added in v1.0.0

## interrupt

Interrupts the fiber running the effect.

**Signature**

```ts
export declare const interrupt: () => STM<never, never, never>
```

Added in v1.0.0

## interruptWith

Interrupts the fiber running the effect with the specified `FiberId`.

**Signature**

```ts
export declare const interruptWith: (fiberId: FiberId.FiberId) => STM<never, never, never>
```

Added in v1.0.0

## iterate

Iterates with the specified transactional function. The moral equivalent
of:

```ts
const s = initial

while (cont(s)) {
  s = body(s)
}

return s
```

**Signature**

```ts
export declare const iterate: <Z>(
  initial: Z,
  cont: (z: Z) => boolean
) => <R, E>(body: (z: Z) => STM<R, E, Z>) => STM<R, E, Z>
```

Added in v1.0.0

## loop

Loops with the specified transactional function, collecting the results
into a list. The moral equivalent of:

```ts
const as = []
let s = initial

while (cont(s)) {
  as.push(body(s))
  s = inc(s)
}

return as
```

**Signature**

```ts
export declare const loop: <Z, R, E, A>(
  initial: Z,
  cont: (z: Z) => boolean,
  inc: (z: Z) => Z,
  body: (z: Z) => STM<R, E, A>
) => STM<R, E, Chunk.Chunk<A>>
```

Added in v1.0.0

## loopDiscard

Loops with the specified transactional function purely for its
transactional effects. The moral equivalent of:

```ts
let s = initial

while (cont(s)) {
  body(s)
  s = inc(s)
}
```

**Signature**

```ts
export declare const loopDiscard: <Z, R, E, X>(
  initial: Z,
  cont: (z: Z) => boolean,
  inc: (z: Z) => Z,
  body: (z: Z) => STM<R, E, X>
) => STM<R, E, void>
```

Added in v1.0.0

## mergeAll

Merges an `Iterable<STM>` to a single `STM`, working sequentially.

**Signature**

```ts
export declare const mergeAll: <A2, A>(
  zero: A2,
  f: (a2: A2, a: A) => A2
) => <R, E>(iterable: Iterable<STM<R, E, A>>) => STM<R, E, A2>
```

Added in v1.0.0

## reduce

Folds an `Iterable<A>` using an effectual function f, working sequentially
from left to right.

**Signature**

```ts
export declare const reduce: <S, A, R, E>(
  zero: S,
  f: (s: S, a: A) => STM<R, E, S>
) => (iterable: Iterable<A>) => STM<R, E, S>
```

Added in v1.0.0

## reduceAll

Reduces an `Iterable<STM>` to a single `STM`, working sequentially.

**Signature**

```ts
export declare const reduceAll: <R2, E2, A>(
  initial: STM<R2, E2, A>,
  f: (x: A, y: A) => A
) => <R, E>(iterable: Iterable<STM<R, E, A>>) => STM<R2 | R, E2 | E, A>
```

Added in v1.0.0

## reduceRight

Folds an `Iterable<A>` using an effectual function f, working sequentially
from right to left.

**Signature**

```ts
export declare const reduceRight: <S, A, R, E>(
  zero: S,
  f: (s: S, a: A) => STM<R, E, S>
) => (iterable: Iterable<A>) => STM<R, E, S>
```

Added in v1.0.0

## replicate

Replicates the given effect n times. If 0 or negative numbers are given, an
empty `Chunk` will be returned.

**Signature**

```ts
export declare const replicate: (n: number) => <R, E, A>(self: STM<R, E, A>) => Chunk.Chunk<STM<R, E, A>>
```

Added in v1.0.0

## replicateSTM

Performs this transaction the specified number of times and collects the
results.

**Signature**

```ts
export declare const replicateSTM: (n: number) => <R, E, A>(self: STM<R, E, A>) => STM<R, E, Chunk.Chunk<A>>
```

Added in v1.0.0

## replicateSTMDiscard

Performs this transaction the specified number of times, discarding the
results.

**Signature**

```ts
export declare const replicateSTMDiscard: (n: number) => <R, E, A>(self: STM<R, E, A>) => STM<R, E, void>
```

Added in v1.0.0

## service

Accesses the specified service in the environment of the effect.

**Signature**

```ts
export declare const service: <T>(tag: Context.Tag<T>) => STM<T, never, T>
```

Added in v1.0.0

## serviceWith

Effectfully accesses the specified service in the environment of the
effect.

**Signature**

```ts
export declare const serviceWith: <T>(tag: Context.Tag<T>) => <A>(f: (service: T) => A) => STM<T, never, A>
```

Added in v1.0.0

## serviceWithSTM

Effectfully accesses the specified service in the environment of the
effect.

**Signature**

```ts
export declare const serviceWithSTM: <T>(
  tag: Context.Tag<T>
) => <R, E, A>(f: (service: T) => STM<R, E, A>) => STM<T | R, E, A>
```

Added in v1.0.0

## succeed

Returns an `STM` effect that succeeds with the specified value.

**Signature**

```ts
export declare const succeed: <A>(value: A) => STM<never, never, A>
```

Added in v1.0.0

## succeedLeft

Returns an effect with the value on the left part.

**Signature**

```ts
export declare const succeedLeft: <A>(value: A) => STM<never, never, Either.Either<A, never>>
```

Added in v1.0.0

## succeedNone

Returns an effect with the empty value.

**Signature**

```ts
export declare const succeedNone: () => STM<never, never, Option.Option<never>>
```

Added in v1.0.0

## succeedRight

Returns an effect with the value on the right part.

**Signature**

```ts
export declare const succeedRight: <A>(value: A) => STM<never, never, Either.Either<never, A>>
```

Added in v1.0.0

## succeedSome

Returns an effect with the optional value.

**Signature**

```ts
export declare const succeedSome: <A>(value: A) => STM<never, never, Option.Option<A>>
```

Added in v1.0.0

## suspend

Suspends creation of the specified transaction lazily.

**Signature**

```ts
export declare const suspend: <R, E, A>(evaluate: LazyArg<STM<R, E, A>>) => STM<R, E, A>
```

Added in v1.0.0

## sync

Returns an `STM` effect that succeeds with the specified lazily evaluated
value.

**Signature**

```ts
export declare const sync: <A>(evaluate: () => A) => STM<never, never, A>
```

Added in v1.0.0

## tryCatch

Imports a synchronous side-effect into a pure value, translating any thrown
exceptions into typed failed effects.

**Signature**

```ts
export declare const tryCatch: <E, A>(attempt: () => A, onThrow: (u: unknown) => E) => Effect.Effect<never, E, A>
```

Added in v1.0.0

## unit

Returns an `STM` effect that succeeds with `Unit`.

**Signature**

```ts
export declare const unit: () => STM<never, never, void>
```

Added in v1.0.0

# destructors

## commit

Commits this transaction atomically.

**Signature**

```ts
export declare const commit: <R, E, A>(self: STM<R, E, A>) => Effect.Effect<R, E, A>
```

Added in v1.0.0

## commitEither

Commits this transaction atomically, regardless of whether the transaction
is a success or a failure.

**Signature**

```ts
export declare const commitEither: <R, E, A>(self: STM<R, E, A>) => Effect.Effect<R, E, A>
```

Added in v1.0.0

# environment

## provideEnvironment

Provides the transaction its required environment, which eliminates its
dependency on `R`.

**Signature**

```ts
export declare const provideEnvironment: <R>(env: Context.Context<R>) => <E, A>(self: STM<R, E, A>) => STM<never, E, A>
```

Added in v1.0.0

## provideSomeEnvironment

Transforms the environment being provided to this effect with the specified
function.

**Signature**

```ts
export declare const provideSomeEnvironment: <R0, R>(
  f: (context: Context.Context<R0>) => Context.Context<R>
) => <E, A>(self: STM<R, E, A>) => STM<R0, E, A>
```

Added in v1.0.0

# error handling

## catchAll

Recovers from all errors.

**Signature**

```ts
export declare const catchAll: <E, R1, E1, B>(
  f: (e: E) => STM<R1, E1, B>
) => <R, A>(self: STM<R, E, A>) => STM<R1 | R, E1, B | A>
```

Added in v1.0.0

## catchSome

Recovers from some or all of the error cases.

**Signature**

```ts
export declare const catchSome: <E, R2, E2, A2>(
  pf: (error: E) => Option.Option<STM<R2, E2, A2>>
) => <R, A>(self: STM<R, E, A>) => STM<R2 | R, E | E2, A2 | A>
```

Added in v1.0.0

## orDie

Translates `STM` effect failure into death of the fiber, making all
failures unchecked and not a part of the type of the effect.

**Signature**

```ts
export declare const orDie: <R, E, A>(self: STM<R, E, A>) => STM<R, never, A>
```

Added in v1.0.0

## orDieWith

Keeps none of the errors, and terminates the fiber running the `STM` effect
with them, using the specified function to convert the `E` into a defect.

**Signature**

```ts
export declare const orDieWith: <E>(f: (error: E) => unknown) => <R, A>(self: STM<R, E, A>) => STM<R, never, A>
```

Added in v1.0.0

## orElse

Tries this effect first, and if it fails or retries, tries the other
effect.

**Signature**

```ts
export declare const orElse: <R2, E2, A2>(
  that: LazyArg<STM<R2, E2, A2>>
) => <R, E, A>(self: STM<R, E, A>) => STM<R2 | R, E2, A2 | A>
```

Added in v1.0.0

## orElseEither

Returns a transactional effect that will produce the value of this effect
in left side, unless it fails or retries, in which case, it will produce
the value of the specified effect in right side.

**Signature**

```ts
export declare const orElseEither: <R2, E2, A2>(
  that: LazyArg<STM<R2, E2, A2>>
) => <R, E, A>(self: STM<R, E, A>) => STM<R2 | R, E2, Either.Either<A, A2>>
```

Added in v1.0.0

## orElseFail

Tries this effect first, and if it fails or retries, fails with the
specified error.

**Signature**

```ts
export declare const orElseFail: <E2>(error: LazyArg<E2>) => <R, E, A>(self: STM<R, E, A>) => STM<R, E2, A>
```

Added in v1.0.0

## orElseOptional

Returns an effect that will produce the value of this effect, unless it
fails with the `None` value, in which case it will produce the value of the
specified effect.

**Signature**

```ts
export declare const orElseOptional: <R2, E2, A2>(
  that: LazyArg<STM<R2, Option.Option<E2>, A2>>
) => <R, E, A>(self: STM<R, Option.Option<E>, A>) => STM<R2 | R, Option.Option<E2 | E>, A2 | A>
```

Added in v1.0.0

## orElseSucceed

Tries this effect first, and if it fails or retries, succeeds with the
specified value.

**Signature**

```ts
export declare const orElseSucceed: <A2>(value: LazyArg<A2>) => <R, E, A>(self: STM<R, E, A>) => STM<R, never, A2 | A>
```

Added in v1.0.0

## orTry

Tries this effect first, and if it enters retry, then it tries the other
effect. This is an equivalent of Haskell's orElse.

**Signature**

```ts
export declare const orTry: <R1, E1, A1>(
  that: () => STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1 | A>
```

Added in v1.0.0

## retry

Abort and retry the whole transaction when any of the underlying
transactional variables have changed.

**Signature**

```ts
export declare const retry: () => STM<never, never, never>
```

Added in v1.0.0

# filtering

## filterOrDie

Dies with specified defect if the predicate fails.

**Signature**

```ts
export declare const filterOrDie: <A>(
  predicate: Predicate<A>,
  defect: LazyArg<unknown>
) => <R, E>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## filterOrDieMessage

Dies with a `Cause.RuntimeException` having the specified message if the
predicate fails.

**Signature**

```ts
export declare const filterOrDieMessage: <A>(
  predicate: Predicate<A>,
  message: string
) => <R, E>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## filterOrElse

Supplies `orElse` if the predicate fails.

**Signature**

```ts
export declare const filterOrElse: <A, R2, E2, A2>(
  predicate: Predicate<A>,
  orElse: LazyArg<STM<R2, E2, A2>>
) => <R, E>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, A | A2>
```

Added in v1.0.0

## filterOrElseWith

Applies `orElse` if the predicate fails.

**Signature**

```ts
export declare const filterOrElseWith: <A, R2, E2, A2>(
  predicate: Predicate<A>,
  orElse: (a: A) => STM<R2, E2, A2>
) => <R, E>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, A | A2>
```

Added in v1.0.0

## filterOrFail

Fails with the specified error if the predicate fails.

**Signature**

```ts
export declare const filterOrFail: <A, E2>(
  predicate: Predicate<A>,
  error: LazyArg<E2>
) => <R, E>(self: STM<R, E, A>) => STM<R, E2 | E, A>
```

Added in v1.0.0

# finalization

## ensuring

Executes the specified finalization transaction whether or not this effect
succeeds. Note that as with all STM transactions, if the full transaction
fails, everything will be rolled back.

**Signature**

```ts
export declare const ensuring: <R1, B>(
  finalizer: STM<R1, never, B>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E, A>
```

Added in v1.0.0

# folding

## fold

Folds over the `STM` effect, handling both failure and success, but not
retry.

**Signature**

```ts
export declare const fold: <E, A2, A, A3>(
  f: (error: E) => A2,
  g: (value: A) => A3
) => <R>(self: STM<R, E, A>) => STM<R, E, A2 | A3>
```

Added in v1.0.0

## foldSTM

Effectfully folds over the `STM` effect, handling both failure and success.

**Signature**

```ts
export declare const foldSTM: <E, R1, E1, A1, A, R2, E2, A2>(
  onFailure: (e: E) => STM<R1, E1, A1>,
  onSuccess: (a: A) => STM<R2, E2, A2>
) => <R>(self: STM<R, E, A>) => STM<R1 | R2 | R, E1 | E2, A1 | A2>
```

Added in v1.0.0

# getters

## head

Returns a successful effect with the head of the list if the list is
non-empty or fails with the error `None` if the list is empty.

**Signature**

```ts
export declare const head: <R, E, A>(self: STM<R, E, Iterable<A>>) => STM<R, Option.Option<E>, A>
```

Added in v1.0.0

## isFailure

Returns whether this transactional effect is a failure.

**Signature**

```ts
export declare const isFailure: <R, E, A>(self: STM<R, E, A>) => STM<R, never, boolean>
```

Added in v1.0.0

## isSuccess

Returns whether this transactional effect is a success.

**Signature**

```ts
export declare const isSuccess: <R, E, A>(self: STM<R, E, A>) => STM<R, never, boolean>
```

Added in v1.0.0

## left

"Zooms in" on the value in the `Left` side of an `Either`, moving the
possibility that the value is a `Right` to the error channel.

**Signature**

```ts
export declare const left: <R, E, A, A2>(self: STM<R, E, Either.Either<A, A2>>) => STM<R, Either.Either<E, A2>, A>
```

Added in v1.0.0

## right

"Zooms in" on the value in the `Right` side of an `Either`, moving the
possibility that the value is a `Left` to the error channel.

**Signature**

```ts
export declare const right: <R, E, A, A2>(self: STM<R, E, Either.Either<A, A2>>) => STM<R, Either.Either<A, E>, A2>
```

Added in v1.0.0

## some

Converts an option on values into an option on errors.

**Signature**

```ts
export declare const some: <R, E, A>(self: STM<R, E, Option.Option<A>>) => STM<R, Option.Option<E>, A>
```

Added in v1.0.0

## someOrElse

Extracts the optional value, or returns the given 'default'.

**Signature**

```ts
export declare const someOrElse: <A2>(
  orElse: LazyArg<A2>
) => <R, E, A>(self: STM<R, E, Option.Option<A>>) => STM<R, E, A2 | A>
```

Added in v1.0.0

## someOrElseSTM

Extracts the optional value, or executes the effect 'default'.

**Signature**

```ts
export declare const someOrElseSTM: <R2, E2, A2>(
  orElse: LazyArg<STM<R2, E2, A2>>
) => <R, E, A>(self: STM<R, E, Option.Option<A>>) => STM<R2 | R, E2 | E, A2 | A>
```

Added in v1.0.0

## someOrFail

Extracts the optional value, or fails with the given error 'e'.

**Signature**

```ts
export declare const someOrFail: <E2>(
  error: LazyArg<E2>
) => <R, E, A>(self: STM<R, E, Option.Option<A>>) => STM<R, E2 | E, A>
```

Added in v1.0.0

## someOrFailException

Extracts the optional value, or fails with a
`Cause.NoSuchElementException`.

**Signature**

```ts
export declare const someOrFailException: <R, E, A>(
  self: STM<R, E, Option.Option<A>>
) => STM<R, E | Cause.NoSuchElementException, A>
```

Added in v1.0.0

## unleft

Converts a `STM<R, Either<E, A>, A2>` into a `STM<R, E, Either<A2, A>>`.
The inverse of `left`.

**Signature**

```ts
export declare const unleft: <R, E, A, A2>(self: STM<R, Either.Either<E, A>, A2>) => STM<R, E, Either.Either<A2, A>>
```

Added in v1.0.0

## unright

Converts a `STM<R, Either<A, E>, A2>` into a `STM<R, E, Either<A, A2>>`.
The inverse of `right`.

**Signature**

```ts
export declare const unright: <R, E, A, A2>(self: STM<R, Either.Either<A, E>, A2>) => STM<R, E, Either.Either<A, A2>>
```

Added in v1.0.0

## unsome

Converts an option on errors into an option on values.

**Signature**

```ts
export declare const unsome: <R, E, A>(self: STM<R, Option.Option<E>, A>) => STM<R, E, Option.Option<A>>
```

Added in v1.0.0

# mapping

## as

Maps the success value of this effect to the specified constant value.

**Signature**

```ts
export declare const as: <A2>(value: A2) => <R, E, A>(self: STM<R, E, A>) => STM<R, E, A2>
```

Added in v1.0.0

## asSome

Maps the success value of this effect to an optional value.

**Signature**

```ts
export declare const asSome: <R, E, A>(self: STM<R, E, A>) => STM<R, E, Option.Option<A>>
```

Added in v1.0.0

## asSomeError

Maps the error value of this effect to an optional value.

**Signature**

```ts
export declare const asSomeError: <R, E, A>(self: STM<R, E, A>) => STM<R, Option.Option<E>, A>
```

Added in v1.0.0

## map

Maps the value produced by the effect.

**Signature**

```ts
export declare const map: <A, B>(f: (a: A) => B) => <R, E>(self: STM<R, E, A>) => STM<R, E, B>
```

Added in v1.0.0

## mapAttempt

Maps the value produced by the effect with the specified function that may
throw exceptions but is otherwise pure, translating any thrown exceptions
into typed failed effects.

**Signature**

```ts
export declare const mapAttempt: <A, B>(f: (a: A) => B) => <R, E>(self: STM<R, E, A>) => STM<R, unknown, B>
```

Added in v1.0.0

## mapBoth

Returns an `STM` effect whose failure and success channels have been mapped
by the specified pair of functions, `f` and `g`.

**Signature**

```ts
export declare const mapBoth: <E, E2, A, A2>(
  f: (error: E) => E2,
  g: (value: A) => A2
) => <R>(self: STM<R, E, A>) => STM<R, E2, A2>
```

Added in v1.0.0

## mapError

Maps from one error type to another.

**Signature**

```ts
export declare const mapError: <E, E2>(f: (error: E) => E2) => <R, A>(self: STM<R, E, A>) => STM<R, E2, A>
```

Added in v1.0.0

# models

## STM (interface)

`STM<R, E, A>` represents an effect that can be performed transactionally,
resulting in a failure `E` or a value `A` that may require an environment
`R` to execute.

Software Transactional Memory is a technique which allows composition of
arbitrary atomic operations. It is the software analog of transactions in
database systems.

The API is lifted directly from the Haskell package Control.Concurrent.STM
although the implementation does not resemble the Haskell one at all.

See http://hackage.haskell.org/package/stm-2.5.0.0/docs/Control-Concurrent-STM.html

STM in Haskell was introduced in:

Composable memory transactions, by Tim Harris, Simon Marlow, Simon Peyton
Jones, and Maurice Herlihy, in ACM Conference on Principles and Practice of
Parallel Programming 2005.

See https://www.microsoft.com/en-us/research/publication/composable-memory-transactions/

See also:
Lock Free Data Structures using STMs in Haskell, by Anthony Discolo, Tim
Harris, Simon Marlow, Simon Peyton Jones, Satnam Singh) FLOPS 2006: Eighth
International Symposium on Functional and Logic Programming, Fuji Susono,
JAPAN, April 2006

https://www.microsoft.com/en-us/research/publication/lock-free-data-structures-using-stms-in-haskell/

The implemtation is based on the ZIO STM module, while JS environments have
no race conditions from multiple threads STM provides greater benefits for
synchronization of Fibers and transactional data-types can be quite useful.

**Signature**

```ts
export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {
  /** @internal */
  trace: string | undefined
  /** @internal */
  traced(trace: string | undefined): STM<R, E, A>
  /** @internal */
  commit(): Effect.Effect<R, E, A>
}
```

Added in v1.0.0

# mutations

## absolve

Returns an effect that submerges the error case of an `Either` into the
`STM`. The inverse operation of `STM.either`.

**Signature**

```ts
export declare const absolve: <R, E, E2, A>(self: STM<R, E, Either.Either<E2, A>>) => STM<R, E | E2, A>
```

Added in v1.0.0

## collect

Simultaneously filters and maps the value produced by this effect.

**Signature**

```ts
export declare const collect: <A, A2>(pf: (a: A) => Option.Option<A2>) => <R, E>(self: STM<R, E, A>) => STM<R, E, A2>
```

Added in v1.0.0

## collectSTM

Simultaneously filters and flatMaps the value produced by this effect.

**Signature**

```ts
export declare const collectSTM: <A, R2, E2, A2>(
  pf: (a: A) => Option.Option<STM<R2, E2, A2>>
) => <R, E>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, A2>
```

Added in v1.0.0

## either

Converts the failure channel into an `Either`.

**Signature**

```ts
export declare const either: <R, E, A>(self: STM<R, E, A>) => STM<R, never, Either.Either<E, A>>
```

Added in v1.0.0

## eventually

Returns an effect that ignores errors and runs repeatedly until it
eventually succeeds.

**Signature**

```ts
export declare const eventually: <R, E, A>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## flip

Flips the success and failure channels of this transactional effect. This
allows you to use all methods on the error channel, possibly before
flipping back.

**Signature**

```ts
export declare const flip: <R, E, A>(self: STM<R, E, A>) => STM<R, A, E>
```

Added in v1.0.0

## flipWith

Swaps the error/value parameters, applies the function `f` and flips the
parameters back

**Signature**

```ts
export declare const flipWith: <R, A, E, R2, A2, E2>(
  f: (stm: STM<R, A, E>) => STM<R2, A2, E2>
) => (self: STM<R, E, A>) => STM<R | R2, E | E2, A | A2>
```

Added in v1.0.0

## ifSTM

Runs `onTrue` if the result of `b` is `true` and `onFalse` otherwise.

**Signature**

```ts
export declare const ifSTM: <R1, R2, E1, E2, A, A1>(
  onTrue: STM<R1, E1, A>,
  onFalse: STM<R2, E2, A1>
) => <R, E>(self: STM<R, E, boolean>) => STM<R1 | R2 | R, E1 | E2 | E, A | A1>
```

Added in v1.0.0

## ignore

Returns a new effect that ignores the success or failure of this effect.

**Signature**

```ts
export declare const ignore: <R, E, A>(self: STM<R, E, A>) => STM<R, never, void>
```

Added in v1.0.0

## merge

Returns a new effect where the error channel has been merged into the
success channel to their common combined type.

**Signature**

```ts
export declare const merge: <R, E, A>(self: STM<R, E, A>) => STM<R, never, E | A>
```

Added in v1.0.0

## negate

Returns a new effect where boolean value of this effect is negated.

**Signature**

```ts
export declare const negate: <R, E>(self: STM<R, E, boolean>) => STM<R, E, boolean>
```

Added in v1.0.0

## none

Requires the option produced by this value to be `None`.

**Signature**

```ts
export declare const none: <R, E, A>(self: STM<R, E, Option.Option<A>>) => STM<R, Option.Option<E>, void>
```

Added in v1.0.0

## option

Converts the failure channel into an `Option`.

**Signature**

```ts
export declare const option: <R, E, A>(self: STM<R, E, A>) => STM<R, never, Option.Option<A>>
```

Added in v1.0.0

## refineOrDie

Keeps some of the errors, and terminates the fiber with the rest.

**Signature**

```ts
export declare const refineOrDie: <E, E2>(
  pf: (error: E) => Option.Option<E2>
) => <R, A>(self: STM<R, E, A>) => STM<R, E2, A>
```

Added in v1.0.0

## refineOrDieWith

Keeps some of the errors, and terminates the fiber with the rest, using the
specified function to convert the `E` into a `Throwable`.

**Signature**

```ts
export declare const refineOrDieWith: <E, E2>(
  pf: (error: E) => Option.Option<E2>,
  f: (error: E) => unknown
) => <R, A>(self: STM<R, E, A>) => STM<R, E2, A>
```

Added in v1.0.0

## reject

Fail with the returned value if the `PartialFunction` matches, otherwise
continue with our held value.

**Signature**

```ts
export declare const reject: <A, E2>(pf: (a: A) => Option.Option<E2>) => <R, E>(self: STM<R, E, A>) => STM<R, E2 | E, A>
```

Added in v1.0.0

## rejectSTM

Continue with the returned computation if the specified partial function
matches, translating the successful match into a failure, otherwise continue
with our held value.

**Signature**

```ts
export declare const rejectSTM: <A, R2, E2>(
  pf: (a: A) => Option.Option<STM<R2, E2, E2>>
) => <R, E>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, A>
```

Added in v1.0.0

## repeatUntil

Repeats this `STM` effect until its result satisfies the specified
predicate.

**WARNING**: `repeatUntil` uses a busy loop to repeat the effect and will
consume a thread until it completes (it cannot yield). This is because STM
describes a single atomic transaction which must either complete, retry or
fail a transaction before yielding back to the Effect runtime.

- Use `retryUntil` instead if you don't need to maintain transaction
  state for repeats.
- Ensure repeating the STM effect will eventually satisfy the predicate.

**Signature**

```ts
export declare const repeatUntil: <A>(predicate: Predicate<A>) => <R, E>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## repeatWhile

Repeats this `STM` effect while its result satisfies the specified
predicate.

**WARNING**: `repeatWhile` uses a busy loop to repeat the effect and will
consume a thread until it completes (it cannot yield). This is because STM
describes a single atomic transaction which must either complete, retry or
fail a transaction before yielding back to the Effect runtime.

- Use `retryWhile` instead if you don't need to maintain transaction
  state for repeats.
- Ensure repeating the STM effect will eventually not satisfy the
  predicate.

**Signature**

```ts
export declare const repeatWhile: <A>(predicate: Predicate<A>) => <R, E>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## retryUntil

Filters the value produced by this effect, retrying the transaction until
the predicate returns `true` for the value.

**Signature**

```ts
export declare const retryUntil: <A>(predicate: Predicate<A>) => <R, E>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## retryWhile

Filters the value produced by this effect, retrying the transaction while
the predicate returns `true` for the value.

**Signature**

```ts
export declare const retryWhile: <A>(predicate: Predicate<A>) => <R, E>(self: STM<R, E, A>) => STM<R, E, A>
```

Added in v1.0.0

## summarized

Summarizes a `STM` effect by computing a provided value before and after
execution, and then combining the values to produce a summary, together
with the result of execution.

**Signature**

```ts
export declare const summarized: <R2, E2, A2, A3>(
  summary: STM<R2, E2, A2>,
  f: (before: A2, after: A2) => A3
) => <R, E, A>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, readonly [A3, A]>
```

Added in v1.0.0

## unless

The moral equivalent of `if (!p) exp`

**Signature**

```ts
export declare const unless: (
  predicate: LazyArg<boolean>
) => <R, E, A>(self: STM<R, E, A>) => STM<R, E, Option.Option<A>>
```

Added in v1.0.0

## unlessSTM

The moral equivalent of `if (!p) exp` when `p` has side-effects

**Signature**

```ts
export declare const unlessSTM: <R2, E2>(
  predicate: STM<R2, E2, boolean>
) => <R, E, A>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, Option.Option<A>>
```

Added in v1.0.0

## validateAll

Feeds elements of type `A` to `f` and accumulates all errors in error
channel or successes in success channel.

This combinator is lossy meaning that if there are errors all successes
will be lost. To retain all information please use `STM.partition`.

**Signature**

```ts
export declare const validateAll: <R, E, A, B>(
  f: (a: A) => STM<R, E, B>
) => (elements: Iterable<A>) => STM<R, Chunk.NonEmptyChunk<E>, Chunk.Chunk<B>>
```

Added in v1.0.0

## validateFirst

Feeds elements of type `A` to `f` until it succeeds. Returns first success
or the accumulation of all errors.

**Signature**

```ts
export declare const validateFirst: <R, E, A, B>(
  f: (a: A) => STM<R, E, B>
) => (elements: Iterable<A>) => STM<R, Chunk.Chunk<E>, B>
```

Added in v1.0.0

## when

The moral equivalent of `if (p) exp`.

**Signature**

```ts
export declare const when: (predicate: LazyArg<boolean>) => <R, E, A>(self: STM<R, E, A>) => STM<R, E, Option.Option<A>>
```

Added in v1.0.0

## whenCase

Runs an effect when the supplied partial function matches for the given
value, otherwise does nothing.

**Signature**

```ts
export declare const whenCase: <R, E, A, B>(
  evaluate: () => A,
  pf: (a: A) => Option.Option<STM<R, E, B>>
) => STM<R, E, Option.Option<B>>
```

Added in v1.0.0

## whenCaseSTM

Runs an effect when the supplied partial function matches for the given
effectful value, otherwise does nothing.

**Signature**

```ts
export declare const whenCaseSTM: <A, R2, E2, A2>(
  pf: (a: A) => Option.Option<STM<R2, E2, A2>>
) => <R, E>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, Option.Option<A2>>
```

Added in v1.0.0

## whenSTM

The moral equivalent of `if (p) exp` when `p` has side-effects.

**Signature**

```ts
export declare const whenSTM: <R2, E2>(
  predicate: STM<R2, E2, boolean>
) => <R, E, A>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, Option.Option<A>>
```

Added in v1.0.0

# sequencing

## flatMap

Feeds the value produced by this effect to the specified function, and then
runs the returned effect as well to produce its results.

**Signature**

```ts
export declare const flatMap: <A, R1, E1, A2>(
  f: (a: A) => STM<R1, E1, A2>
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2>
```

Added in v1.0.0

## flatMapError

Creates a composite effect that represents this effect followed by another
one that may depend on the error produced by this one.

**Signature**

```ts
export declare const flatMapError: <E, R2, E2>(
  f: (error: E) => STM<R2, never, E2>
) => <R, A>(self: STM<R, E, A>) => STM<R2 | R, E2, A>
```

Added in v1.0.0

## flatten

Flattens out a nested `STM` effect.

**Signature**

```ts
export declare const flatten: <R, E, R2, E2, A>(self: STM<R, E, STM<R2, E2, A>>) => STM<R | R2, E | E2, A>
```

Added in v1.0.0

## flattenErrorOption

Unwraps the optional error, defaulting to the provided value.

**Signature**

```ts
export declare const flattenErrorOption: <E2>(
  fallback: LazyArg<E2>
) => <R, E, A>(self: STM<R, Option.Option<E>, A>) => STM<R, E2 | E, A>
```

Added in v1.0.0

## tap

"Peeks" at the success of transactional effect.

**Signature**

```ts
export declare const tap: <A, R2, E2, _>(
  f: (a: A) => STM<R2, E2, _>
) => <R, E>(self: STM<R, E, A>) => STM<R2 | R, E2 | E, A>
```

Added in v1.0.0

## tapBoth

"Peeks" at both sides of an transactional effect.

**Signature**

```ts
export declare const tapBoth: <E, R2, E2, A2, A, R3, E3, A3>(
  f: (error: E) => STM<R2, E2, A2>,
  g: (value: A) => STM<R3, E3, A3>
) => <R>(self: STM<R, E, A>) => STM<R2 | R3 | R, E | E2 | E3, A>
```

Added in v1.0.0

## tapError

"Peeks" at the error of the transactional effect.

**Signature**

```ts
export declare const tapError: <E, R2, E2, _>(
  f: (error: E) => STM<R2, E2, _>
) => <R, A>(self: STM<R, E, A>) => STM<R2 | R, E | E2, A>
```

Added in v1.0.0

# symbols

## STMTypeId

**Signature**

```ts
export declare const STMTypeId: typeof STMTypeId
```

Added in v1.0.0

## STMTypeId (type alias)

**Signature**

```ts
export type STMTypeId = typeof STMTypeId
```

Added in v1.0.0

# traversing

## forEach

Applies the function `f` to each element of the `Iterable<A>` and returns
a transactional effect that produces a new `Chunk<A2>`.

**Signature**

```ts
export declare const forEach: <A, R, E, A2>(
  f: (a: A) => STM<R, E, A2>
) => (elements: Iterable<A>) => STM<R, E, Chunk.Chunk<A2>>
```

Added in v1.0.0

## forEachDiscard

Applies the function `f` to each element of the `Iterable<A>` and returns a
transactional effect that produces the unit result.

Equivalent to `pipe(as, forEach(f), asUnit)`, but without the cost of
building the list of results.

**Signature**

```ts
export declare const forEachDiscard: <A, R, E, _>(
  f: (a: A) => STM<R, E, _>
) => (iterable: Iterable<A>) => STM<R, E, void>
```

Added in v1.0.0

## partition

Feeds elements of type `A` to a function `f` that returns an effect.
Collects all successes and failures in a tupled fashion.

**Signature**

```ts
export declare const partition: <R, E, A, A2>(
  f: (a: A) => STM<R, E, A2>
) => (elements: Iterable<A>) => STM<R, E, readonly [Chunk.Chunk<E>, Chunk.Chunk<A2>]>
```

Added in v1.0.0

# zipping

## zip

Sequentially zips this value with the specified one.

**Signature**

```ts
export declare const zip: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, readonly [A, A1]>
```

Added in v1.0.0

## zipLeft

Sequentially zips this value with the specified one, discarding the second
element of the tuple.

**Signature**

```ts
export declare const zipLeft: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A>
```

Added in v1.0.0

## zipRight

Sequentially zips this value with the specified one, discarding the first
element of the tuple.

**Signature**

```ts
export declare const zipRight: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1>
```

Added in v1.0.0

## zipWith

Sequentially zips this value with the specified one, combining the values
using the specified combiner function.

**Signature**

```ts
export declare const zipWith: <R1, E1, A1, A, A2>(
  that: STM<R1, E1, A1>,
  f: (a: A, b: A1) => A2
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2>
```

Added in v1.0.0
