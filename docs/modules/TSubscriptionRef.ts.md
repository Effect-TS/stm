---
title: TSubscriptionRef.ts
nav_order: 13
parent: Modules
---

## TSubscriptionRef overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [make](#make)
- [getters](#getters)
  - [get](#get)
- [models](#models)
  - [TSubscriptionRef (interface)](#tsubscriptionref-interface)
- [symbols](#symbols)
  - [TSubscriptionRefTypeId](#tsubscriptionreftypeid)
  - [TSubscriptionRefTypeId (type alias)](#tsubscriptionreftypeid-type-alias)
- [utils](#utils)
  - [TSubscriptionRef (namespace)](#tsubscriptionref-namespace)
    - [Variance (interface)](#variance-interface)
  - [getAndSet](#getandset)
  - [getAndUpdate](#getandupdate)
  - [getAndUpdateSome](#getandupdatesome)
  - [modify](#modify)
  - [modifySome](#modifysome)
  - [set](#set)
  - [setAndGet](#setandget)
  - [update](#update)
  - [updateAndGet](#updateandget)
  - [updateSome](#updatesome)
  - [updateSomeAndGet](#updatesomeandget)

---

# constructors

## make

Creates a new `TSubscriptionRef` with the specified value.

**Signature**

```ts
export declare const make: <A>(value: A) => STM.STM<never, never, TSubscriptionRef<A>>
```

Added in v1.0.0

# getters

## get

**Signature**

```ts
export declare const get: <A>(self: TSubscriptionRef<A>) => STM.STM<never, never, A>
```

Added in v1.0.0

# models

## TSubscriptionRef (interface)

A `TSubscriptionRef<A>` is a `TRef` that can be subscribed to in order to
receive the current value as well as all committed changes to the value.

**Signature**

```ts
export interface TSubscriptionRef<A> extends TSubscriptionRef.Variance<A> {
  /** @internal */
  readonly ref: TRef.TRef<A>
  /**
   * A hub to subscribe for changes transactionally
   */
  readonly hub: THub.THub<A>
  /**
   * A stream containing the current value of the `TRef` as well as all comitted
   * changes to that value.
   */
  readonly changes: Stream.Stream<never, never, A>
}
```

Added in v1.0.0

# symbols

## TSubscriptionRefTypeId

**Signature**

```ts
export declare const TSubscriptionRefTypeId: typeof TSubscriptionRefTypeId
```

Added in v1.0.0

## TSubscriptionRefTypeId (type alias)

**Signature**

```ts
export type TSubscriptionRefTypeId = typeof TSubscriptionRefTypeId
```

Added in v1.0.0

# utils

## TSubscriptionRef (namespace)

Added in v1.0.0

### Variance (interface)

**Signature**

```ts
export interface Variance<A> {
  readonly [TSubscriptionRefTypeId]: {
    readonly _A: (_: never) => A
  }
}
```

Added in v1.0.0

## getAndSet

**Signature**

```ts
export declare const getAndSet: {
  <A>(value: A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, value: A): STM.STM<never, never, A>
}
```

Added in v1.0.0

## getAndUpdate

**Signature**

```ts
export declare const getAndUpdate: {
  <A>(f: (a: A) => A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => A): STM.STM<never, never, A>
}
```

Added in v1.0.0

## getAndUpdateSome

**Signature**

```ts
export declare const getAndUpdateSome: {
  <A>(pf: (a: A) => Option.Option<A>): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, pf: (a: A) => Option.Option<A>): STM.STM<never, never, A>
}
```

Added in v1.0.0

## modify

**Signature**

```ts
export declare const modify: {
  <A, B>(f: (a: A) => readonly [B, A]): (self: TSubscriptionRef<A>) => STM.STM<never, never, B>
  <A, B>(self: TSubscriptionRef<A>, f: (a: A) => readonly [B, A]): STM.STM<never, never, B>
}
```

Added in v1.0.0

## modifySome

**Signature**

```ts
export declare const modifySome: {
  <B, A>(fallback: B, pf: (a: A) => Option.Option<readonly [B, A]>): (
    self: TSubscriptionRef<A>
  ) => STM.STM<never, never, B>
  <A, B>(self: TSubscriptionRef<A>, fallback: B, pf: (a: A) => Option.Option<readonly [B, A]>): STM.STM<never, never, B>
}
```

Added in v1.0.0

## set

**Signature**

```ts
export declare const set: {
  <A>(value: A): (self: TSubscriptionRef<A>) => STM.STM<never, never, void>
  <A>(self: TSubscriptionRef<A>, value: A): STM.STM<never, never, void>
}
```

Added in v1.0.0

## setAndGet

**Signature**

```ts
export declare const setAndGet: {
  <A>(value: A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, value: A): STM.STM<never, never, A>
}
```

Added in v1.0.0

## update

**Signature**

```ts
export declare const update: {
  <A>(f: (a: A) => A): (self: TSubscriptionRef<A>) => STM.STM<never, never, void>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => A): STM.STM<never, never, void>
}
```

Added in v1.0.0

## updateAndGet

**Signature**

```ts
export declare const updateAndGet: {
  <A>(f: (a: A) => A): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => A): STM.STM<never, never, A>
}
```

Added in v1.0.0

## updateSome

**Signature**

```ts
export declare const updateSome: {
  <A>(f: (a: A) => Option.Option<A>): (self: TSubscriptionRef<A>) => STM.STM<never, never, void>
  <A>(self: TSubscriptionRef<A>, f: (a: A) => Option.Option<A>): STM.STM<never, never, void>
}
```

Added in v1.0.0

## updateSomeAndGet

**Signature**

```ts
export declare const updateSomeAndGet: {
  <A>(pf: (a: A) => Option.Option<A>): (self: TSubscriptionRef<A>) => STM.STM<never, never, A>
  <A>(self: TSubscriptionRef<A>, pf: (a: A) => Option.Option<A>): STM.STM<never, never, A>
}
```

Added in v1.0.0
