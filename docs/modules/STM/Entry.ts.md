---
title: STM/Entry.ts
nav_order: 2
parent: Modules
---

## Entry overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Entry (interface)](#entry-interface)
  - [Versioned (interface)](#versioned-interface)
  - [commit](#commit)
  - [copy](#copy)
  - [isChanged](#ischanged)
  - [isInvalid](#isinvalid)
  - [isValid](#isvalid)
  - [make](#make)
  - [unsafeGet](#unsafeget)
  - [unsafeSet](#unsafeset)

---

# utils

## Entry (interface)

**Signature**

```ts
export interface Entry {
  readonly ref: TRef.TRef<unknown>
  readonly expected: Versioned<unknown>
  isChanged: boolean
  readonly isNew: boolean
  newValue: unknown
}
```

Added in v1.0.0

## Versioned (interface)

**Signature**

```ts
export interface Versioned<A> {
  readonly value: A
}
```

Added in v1.0.0

## commit

**Signature**

```ts
export declare const commit: (self: Entry) => void
```

Added in v1.0.0

## copy

**Signature**

```ts
export declare const copy: (self: Entry) => Entry
```

Added in v1.0.0

## isChanged

**Signature**

```ts
export declare const isChanged: (self: Entry) => boolean
```

Added in v1.0.0

## isInvalid

**Signature**

```ts
export declare const isInvalid: (self: Entry) => boolean
```

Added in v1.0.0

## isValid

**Signature**

```ts
export declare const isValid: (self: Entry) => boolean
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (ref: TRef.TRef<unknown>, isNew: boolean) => Entry
```

Added in v1.0.0

## unsafeGet

**Signature**

```ts
export declare const unsafeGet: (self: Entry) => unknown
```

Added in v1.0.0

## unsafeSet

**Signature**

```ts
export declare const unsafeSet: (self: Entry, value: unknown) => void
```

Added in v1.0.0
