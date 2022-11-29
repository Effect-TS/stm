/**
 * @since 1.0.0
 */
import type * as TRef from "@effect/stm/TRef"

/** @internal */
import * as internal from "@effect/io/internal/stm/entry"

/**
 * @since 1.0.0
 */
export interface Versioned<A> {
  readonly value: A
}

/**
 * @since 1.0.0
 */
export interface Entry {
  readonly ref: TRef.TRef<unknown>
  readonly expected: Versioned<unknown>
  isChanged: boolean
  readonly isNew: boolean
  newValue: unknown
}

/**
 * @since 1.0.0
 */
export const make: (ref: TRef.TRef<unknown>, isNew: boolean) => Entry = internal.make

/**
 * @since 1.0.0
 */
export const unsafeGet: (self: Entry) => unknown = internal.unsafeGet

/**
 * @since 1.0.0
 */
export const unsafeSet: (self: Entry, value: unknown) => void = internal.unsafeSet

/**
 * @since 1.0.0
 */
export const commit: (self: Entry) => void = internal.commit

/**
 * @since 1.0.0
 */
export const copy: (self: Entry) => Entry = internal.copy

/**
 * @since 1.0.0
 */
export const isValid: (self: Entry) => boolean = internal.isValid

/**
 * @since 1.0.0
 */
export const isInvalid: (self: Entry) => boolean = internal.isInvalid

/**
 * @since 1.0.0
 */
export const isChanged: (self: Entry) => boolean = internal.isChanged
