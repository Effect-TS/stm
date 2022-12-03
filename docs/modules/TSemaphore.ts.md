---
title: TSemaphore.ts
nav_order: 3
parent: Modules
---

## TSemaphore overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [TSemaphore (interface)](#tsemaphore-interface)
  - [TSemaphoreTypeId](#tsemaphoretypeid)
  - [TSemaphoreTypeId (type alias)](#tsemaphoretypeid-type-alias)
  - [acquire](#acquire)
  - [acquireN](#acquiren)
  - [available](#available)
  - [make](#make)
  - [release](#release)
  - [releaseN](#releasen)
  - [unsafeMake](#unsafemake)
  - [withPermit](#withpermit)
  - [withPermitScoped](#withpermitscoped)
  - [withPermits](#withpermits)
  - [withPermitsScoped](#withpermitsscoped)

---

# utils

## TSemaphore (interface)

**Signature**

```ts
export interface TSemaphore {
  readonly [TSemaphoreTypeId]: TSemaphoreTypeId
}
```

Added in v1.0.0

## TSemaphoreTypeId

**Signature**

```ts
export declare const TSemaphoreTypeId: typeof TSemaphoreTypeId
```

Added in v1.0.0

## TSemaphoreTypeId (type alias)

**Signature**

```ts
export type TSemaphoreTypeId = typeof TSemaphoreTypeId
```

Added in v1.0.0

## acquire

**Signature**

```ts
export declare const acquire: (self: TSemaphore) => STM<never, never, void>
```

Added in v1.0.0

## acquireN

**Signature**

```ts
export declare const acquireN: (n: number) => (self: TSemaphore) => STM<never, never, void>
```

Added in v1.0.0

## available

**Signature**

```ts
export declare const available: (self: TSemaphore) => STM<never, never, number>
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (permits: number) => STM<never, never, TSemaphore>
```

Added in v1.0.0

## release

**Signature**

```ts
export declare const release: (self: TSemaphore) => STM<never, never, void>
```

Added in v1.0.0

## releaseN

**Signature**

```ts
export declare const releaseN: (n: number) => (self: TSemaphore) => STM<never, never, void>
```

Added in v1.0.0

## unsafeMake

**Signature**

```ts
export declare const unsafeMake: (permits: number) => TSemaphore
```

Added in v1.0.0

## withPermit

**Signature**

```ts
export declare const withPermit: (semaphore: TSemaphore) => <R, E, A>(self: Effect<R, E, A>) => Effect<R, E, A>
```

Added in v1.0.0

## withPermitScoped

**Signature**

```ts
export declare const withPermitScoped: (self: TSemaphore) => Effect<Scope, never, void>
```

Added in v1.0.0

## withPermits

**Signature**

```ts
export declare const withPermits: (
  permits: number
) => (semaphore: TSemaphore) => <R, E, A>(self: Effect<R, E, A>) => Effect<R, E, A>
```

Added in v1.0.0

## withPermitsScoped

**Signature**

```ts
export declare const withPermitsScoped: (permits: number) => (self: TSemaphore) => Effect<Scope, never, void>
```

Added in v1.0.0
