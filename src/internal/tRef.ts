import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as Entry from "@effect/stm/internal/stm/entry"
import type * as Journal from "@effect/stm/internal/stm/journal"
import type * as TxnId from "@effect/stm/internal/stm/txnId"
import * as Versioned from "@effect/stm/internal/stm/versioned"
import type * as STM from "@effect/stm/STM"
import type * as TRef from "@effect/stm/TRef"
import * as Equal from "@fp-ts/data/Equal"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const TRefSymbolKey = "@effect/stm/TRef"

/** @internal */
export const TRefTypeId: TRef.TRefTypeId = Symbol.for(
  TRefSymbolKey
) as TRef.TRefTypeId

/** @internal */
const tRefVariance = {
  _A: (_: never) => _
}

/** @internal */
export class TRefImpl<A> implements TRef.TRef<A> {
  readonly [TRefTypeId] = tRefVariance
  /** @internal */
  todos: Map<TxnId.TxnId, Journal.Todo>
  /** @internal */
  versioned: Versioned.Versioned<A>
  constructor(value: A) {
    Equal.considerByRef(this)
    this.versioned = new Versioned.Versioned(value)
    this.todos = new Map()
  }
  modify<B>(f: (a: A) => readonly [B, A]): STM.STM<never, never, B> {
    return core.withSTMRuntime((_) => {
      const entry = getOrMakeEntry(this, _.journal)
      const [retValue, newValue] = f(Entry.unsafeGet(entry) as A)
      Entry.unsafeSet(entry, newValue)
      return core.succeed(retValue)
    })
  }
}

/**
 * @macro traced
 * @internal
 */
export const make = <A>(value: A): STM.STM<never, never, TRef.TRef<A>> => {
  const trace = getCallTrace()
  return core.withSTMRuntime((_) => {
    const ref = new TRefImpl(value)
    _.journal.set(ref, Entry.make(ref, true))
    return core.succeed(ref)
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const get = <A>(self: TRef.TRef<A>) => {
  const trace = getCallTrace()
  return self.modify((a) => [a, a]).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const set = <A>(value: A) =>
  (self: TRef.TRef<A>) => {
    const trace = getCallTrace()
    return self.modify((): [void, A] => [void 0, value]).traced(trace)
  }

/**
 * @macro traced
 * @internal
 */
export const getAndSet = <A>(value: A) =>
  (self: TRef.TRef<A>) => {
    const trace = getCallTrace()
    return self.modify((a): [A, A] => [a, value]).traced(trace)
  }

/**
 * @macro traced
 * @internal
 */
export const getAndUpdate = <A>(f: (a: A) => A) =>
  (self: TRef.TRef<A>) => {
    const trace = getCallTrace()
    return self.modify((a): [A, A] => [a, f(a)]).traced(trace)
  }

/**
 * @macro traced
 * @internal
 */
export const getAndUpdateSome = <A>(f: (a: A) => Option.Option<A>) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) =>
    self.modify((a): [A, A] =>
      pipe(
        f(a),
        Option.match(() => [a, a], (b) => [a, b])
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const setAndGet = <A>(value: A) =>
  (self: TRef.TRef<A>) => {
    const trace = getCallTrace()
    return self.modify((): [A, A] => [value, value]).traced(trace)
  }

/**
 * @macro traced
 * @internal
 */
export const modify = <A, B>(f: (a: A) => readonly [B, A]) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) => self.modify(f).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const modifySome = <A, B>(fallback: B, f: (a: A) => Option.Option<readonly [B, A]>) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) =>
    self.modify((a) =>
      pipe(
        f(a),
        Option.match(
          () => [fallback, a],
          (b) => b
        )
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const update = <A>(f: (a: A) => A) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) => self.modify((a): [void, A] => [void 0, f(a)]).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const updateAndGet = <A>(f: (a: A) => A) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) =>
    self.modify((a): [A, A] => {
      const b = f(a)
      return [b, b]
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const updateSome = <A>(f: (a: A) => Option.Option<A>) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) =>
    self.modify((a): [void, A] => [void 0, pipe(f(a), Option.match(() => a, (b) => b))]).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const updateSomeAndGet = <A>(f: (a: A) => Option.Option<A>) => {
  const trace = getCallTrace()
  return (self: TRef.TRef<A>) =>
    self.modify((a): [A, A] => pipe(f(a), Option.match(() => [a, a], (b) => [b, b]))).traced(trace)
}

/** @internal */
const getOrMakeEntry = <A>(self: TRef.TRef<A>, journal: Journal.Journal): Entry.Entry => {
  if (journal.has(self)) {
    return journal.get(self)!
  }
  const entry = Entry.make(self, false)
  journal.set(self, entry)
  return entry
}

/** @internal */
export const unsafeGet = (journal: Journal.Journal) => {
  return <A>(self: TRef.TRef<A>): A => {
    return Entry.unsafeGet(getOrMakeEntry(self, journal)) as A
  }
}

/** @internal */
export const unsafeSet = <A>(value: A, journal: Journal.Journal) => {
  return (self: TRef.TRef<A>): void => {
    const entry = getOrMakeEntry(self, journal)
    Entry.unsafeSet(entry, value)
    return undefined
  }
}
