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
  - [succeed](#succeed)

---

# utils

## STM (interface)

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

## succeed

**Signature**

```ts
export declare const succeed: <A>(value: A) => STM<never, never, A>
```

Added in v1.0.0
