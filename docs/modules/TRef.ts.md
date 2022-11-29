---
title: TRef.ts
nav_order: 3
parent: Modules
---

## TRef overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [TRef (interface)](#tref-interface)
  - [TRefTypeId](#treftypeid)
  - [TRefTypeId (type alias)](#treftypeid-type-alias)
  - [get](#get)
  - [getAndSet](#getandset)
  - [getAndUpdate](#getandupdate)
  - [getAndUpdateSome](#getandupdatesome)
  - [make](#make)
  - [modify](#modify)
  - [modifySome](#modifysome)
  - [set](#set)
  - [setAndGet](#setandget)
  - [unsafeGet](#unsafeget)
  - [unsafeSet](#unsafeset)
  - [update](#update)
  - [updateAndGet](#updateandget)
  - [updateSome](#updatesome)
  - [updateSomeAndGet](#updatesomeandget)

---

# utils

## TRef (interface)

**Signature**

```ts
export interface TRef<A> extends TRef.Variance<A> {
  /**
   * Note: the method is unbound, exposed only for potential extensions.
   */
  modify<B>(f: (a: A) => readonly [B, A]): STM<never, never, B>
}
```

Added in v1.0.0

## TRefTypeId

**Signature**

```ts
export declare const TRefTypeId: typeof TRefTypeId
```

Added in v1.0.0

## TRefTypeId (type alias)

**Signature**

```ts
export type TRefTypeId = typeof TRefTypeId
```

Added in v1.0.0

## get

**Signature**

```ts
export declare const get: <A>(self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0

## getAndSet

**Signature**

```ts
export declare const getAndSet: <A>(value: A) => (self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0

## getAndUpdate

**Signature**

```ts
export declare const getAndUpdate: <A>(f: (a: A) => A) => (self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0

## getAndUpdateSome

**Signature**

```ts
export declare const getAndUpdateSome: <A>(f: (a: A) => Option<A>) => (self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: <A>(evaluate: () => A) => STM<never, never, TRef<A>>
```

Added in v1.0.0

## modify

**Signature**

```ts
export declare const modify: <A, B>(f: (a: A) => readonly [B, A]) => (self: TRef<A>) => STM<never, never, B>
```

Added in v1.0.0

## modifySome

**Signature**

```ts
export declare const modifySome: <A, B>(
  fallback: B,
  f: (a: A) => Option<readonly [B, A]>
) => (self: TRef<A>) => STM<never, never, B>
```

Added in v1.0.0

## set

**Signature**

```ts
export declare const set: <A>(value: A) => (self: TRef<A>) => STM<never, never, void>
```

Added in v1.0.0

## setAndGet

**Signature**

```ts
export declare const setAndGet: <A>(value: A) => (self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0

## unsafeGet

**Signature**

```ts
export declare const unsafeGet: (journal: Journal) => <A>(self: TRef<A>) => A
```

Added in v1.0.0

## unsafeSet

**Signature**

```ts
export declare const unsafeSet: <A>(value: A, journal: Journal) => (self: TRef<A>) => void
```

Added in v1.0.0

## update

**Signature**

```ts
export declare const update: <A>(f: (a: A) => A) => (self: TRef<A>) => STM<never, never, void>
```

Added in v1.0.0

## updateAndGet

**Signature**

```ts
export declare const updateAndGet: <A>(f: (a: A) => A) => (self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0

## updateSome

**Signature**

```ts
export declare const updateSome: <A>(f: (a: A) => Option<A>) => (self: TRef<A>) => STM<never, never, void>
```

Added in v1.0.0

## updateSomeAndGet

**Signature**

```ts
export declare const updateSomeAndGet: <A>(f: (a: A) => Option<A>) => (self: TRef<A>) => STM<never, never, A>
```

Added in v1.0.0
