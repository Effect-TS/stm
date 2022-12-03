---
title: STM.ts
nav_order: 1
parent: Modules
---

## STM overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [STM (interface)](#stm-interface)
  - [STMTypeId](#stmtypeid)
  - [STMTypeId (type alias)](#stmtypeid-type-alias)
  - [catchAll](#catchall)
  - [commit](#commit)
  - [die](#die)
  - [ensuring](#ensuring)
  - [fail](#fail)
  - [flatMap](#flatmap)
  - [foldSTM](#foldstm)
  - [interrupt](#interrupt)
  - [map](#map)
  - [orTry](#ortry)
  - [provideSomeEnvironment](#providesomeenvironment)
  - [retry](#retry)
  - [succeed](#succeed)
  - [sync](#sync)
  - [zip](#zip)
  - [zipLeft](#zipleft)
  - [zipRight](#zipright)
  - [zipWith](#zipwith)

---

# utils

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
export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {}
```

Added in v1.0.0

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

## catchAll

**Signature**

```ts
export declare const catchAll: <E, R1, E1, B>(
  f: (e: E) => STM<R1, E1, B>
) => <R, A>(self: STM<R, E, A>) => STM<R1 | R, E1, B | A>
```

Added in v1.0.0

## commit

**Signature**

```ts
export declare const commit: <R, E, A>(self: STM<R, E, A>) => Effect.Effect<R, E, A>
```

Added in v1.0.0

## die

**Signature**

```ts
export declare const die: (defect: unknown) => STM<never, never, never>
```

Added in v1.0.0

## ensuring

**Signature**

```ts
export declare const ensuring: <R1, B>(
  finalizer: STM<R1, never, B>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E, A>
```

Added in v1.0.0

## fail

**Signature**

```ts
export declare const fail: <E>(error: E) => STM<never, E, never>
```

Added in v1.0.0

## flatMap

**Signature**

```ts
export declare const flatMap: <A, R1, E1, A2>(
  f: (a: A) => STM<R1, E1, A2>
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2>
```

Added in v1.0.0

## foldSTM

**Signature**

```ts
export declare const foldSTM: <E, R1, E1, A1, A, R2, E2, A2>(
  onFailure: (e: E) => STM<R1, E1, A1>,
  onSuccess: (a: A) => STM<R2, E2, A2>
) => <R>(self: STM<R, E, A>) => STM<R1 | R2 | R, E1 | E2, A1 | A2>
```

Added in v1.0.0

## interrupt

**Signature**

```ts
export declare const interrupt: () => STM<never, never, never>
```

Added in v1.0.0

## map

**Signature**

```ts
export declare const map: <A, B>(f: (a: A) => B) => <R, E>(self: STM<R, E, A>) => STM<R, E, B>
```

Added in v1.0.0

## orTry

**Signature**

```ts
export declare const orTry: <R1, E1, A1>(
  that: () => STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1 | A>
```

Added in v1.0.0

## provideSomeEnvironment

**Signature**

```ts
export declare const provideSomeEnvironment: <R0, R>(
  f: (context: Context.Context<R0>) => Context.Context<R>
) => <E, A>(self: STM<R, E, A>) => STM<R0, E, A>
```

Added in v1.0.0

## retry

**Signature**

```ts
export declare const retry: () => STM<never, never, never>
```

Added in v1.0.0

## succeed

**Signature**

```ts
export declare const succeed: <A>(value: A) => STM<never, never, A>
```

Added in v1.0.0

## sync

**Signature**

```ts
export declare const sync: <A>(evaluate: () => A) => STM<never, never, A>
```

Added in v1.0.0

## zip

**Signature**

```ts
export declare const zip: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, readonly [A, A1]>
```

Added in v1.0.0

## zipLeft

**Signature**

```ts
export declare const zipLeft: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A>
```

Added in v1.0.0

## zipRight

**Signature**

```ts
export declare const zipRight: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1>
```

Added in v1.0.0

## zipWith

**Signature**

```ts
export declare const zipWith: <R1, E1, A1, A, A2>(
  that: STM<R1, E1, A1>,
  f: (a: A, b: A1) => A2
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2>
```

Added in v1.0.0
