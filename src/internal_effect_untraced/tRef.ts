import * as Debug from "@effect/io/Debug"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as Entry from "@effect/stm/internal_effect_untraced/stm/entry"
import type * as Journal from "@effect/stm/internal_effect_untraced/stm/journal"
import type * as TxnId from "@effect/stm/internal_effect_untraced/stm/txnId"
import * as Versioned from "@effect/stm/internal_effect_untraced/stm/versioned"
import type * as STM from "@effect/stm/STM"
import type * as TRef from "@effect/stm/TRef"
import { pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"

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
    this.versioned = new Versioned.Versioned(value)
    this.todos = new Map()
  }
  modify<B>(f: (a: A) => readonly [B, A]): STM.STM<never, never, B> {
    return core.effect<never, B>((journal) => {
      const entry = getOrMakeEntry(this, journal)
      const [retValue, newValue] = f(Entry.unsafeGet(entry) as A)
      Entry.unsafeSet(entry, newValue)
      return retValue
    })
  }
}

/**
 * @internal
 */
export const make = Debug.methodWithTrace((trace) =>
  <A>(value: A): STM.STM<never, never, TRef.TRef<A>> =>
    core.effect<never, TRef.TRef<A>>((journal) => {
      const ref = new TRefImpl(value)
      journal.set(ref, Entry.make(ref, true))
      return ref
    }).traced(trace)
)

/**
 * @internal
 */
export const get = Debug.methodWithTrace((trace) => <A>(self: TRef.TRef<A>) => self.modify((a) => [a, a]).traced(trace))

/**
 * @internal
 */
export const set = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, value: A) => STM.STM<never, never, void>,
  <A>(value: A) => (self: TRef.TRef<A>) => STM.STM<never, never, void>
>(
  2,
  (trace) =>
    <A>(self: TRef.TRef<A>, value: A): STM.STM<never, never, void> =>
      self.modify((): [void, A] => [void 0, value]).traced(trace)
)

/**
 * @internal
 */
export const getAndSet = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, value: A) => STM.STM<never, never, A>,
  <A>(value: A) => (self: TRef.TRef<A>) => STM.STM<never, never, A>
>(2, (trace) => (self, value) => self.modify((a) => [a, value]).traced(trace))

/**
 * @internal
 */
export const getAndUpdate = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, f: (a: A) => A) => STM.STM<never, never, A>,
  <A>(f: (a: A) => A) => (self: TRef.TRef<A>) => STM.STM<never, never, A>
>(2, (trace, restore) => (self, f) => self.modify((a) => [a, restore(f)(a)]).traced(trace))

/**
 * @internal
 */
export const getAndUpdateSome = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, f: (a: A) => Option.Option<A>) => STM.STM<never, never, A>,
  <A>(f: (a: A) => Option.Option<A>) => (self: TRef.TRef<A>) => STM.STM<never, never, A>
>(2, (trace, restore) =>
  (self, f) =>
    self.modify((a) =>
      pipe(
        restore(f)(a),
        Option.match(() => [a, a], (b) => [a, b])
      )
    ).traced(trace))

/**
 * @internal
 */
export const setAndGet = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, value: A) => STM.STM<never, never, A>,
  <A>(value: A) => (self: TRef.TRef<A>) => STM.STM<never, never, A>
>(2, (trace) => (self, value) => self.modify(() => [value, value]).traced(trace))

/**
 * @internal
 */
export const modify = Debug.dualWithTrace<
  <A, B>(self: TRef.TRef<A>, f: (a: A) => readonly [B, A]) => STM.STM<never, never, B>,
  <A, B>(f: (a: A) => readonly [B, A]) => (self: TRef.TRef<A>) => STM.STM<never, never, B>
>(2, (trace, restore) => (self, f) => self.modify(restore(f)).traced(trace))

/**
 * @internal
 */
export const modifySome = Debug.dualWithTrace<
  <A, B>(self: TRef.TRef<A>, fallback: B, f: (a: A) => Option.Option<readonly [B, A]>) => STM.STM<never, never, B>,
  <A, B>(fallback: B, f: (a: A) => Option.Option<readonly [B, A]>) => (self: TRef.TRef<A>) => STM.STM<never, never, B>
>(3, (trace, restore) =>
  (self, fallback, f) =>
    self.modify((a) =>
      pipe(
        restore(f)(a),
        Option.match(
          () => [fallback, a],
          (b) => b
        )
      )
    ).traced(trace))

/**
 * @internal
 */
export const update = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, f: (a: A) => A) => STM.STM<never, never, void>,
  <A>(f: (a: A) => A) => (self: TRef.TRef<A>) => STM.STM<never, never, void>
>(2, (trace, restore) => (self, f) => self.modify((a) => [void 0, restore(f)(a)]).traced(trace))

/**
 * @internal
 */
export const updateAndGet = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, f: (a: A) => A) => STM.STM<never, never, A>,
  <A>(f: (a: A) => A) => (self: TRef.TRef<A>) => STM.STM<never, never, A>
>(2, (trace, restore) =>
  (self, f) =>
    self.modify((a) => {
      const b = restore(f)(a)
      return [b, b]
    }).traced(trace))

/**
 * @internal
 */
export const updateSome = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, f: (a: A) => Option.Option<A>) => STM.STM<never, never, void>,
  <A>(f: (a: A) => Option.Option<A>) => (self: TRef.TRef<A>) => STM.STM<never, never, void>
>(
  2,
  (trace, restore) =>
    (self, f) => self.modify((a) => [void 0, pipe(restore(f)(a), Option.match(() => a, (b) => b))]).traced(trace)
)

/**
 * @internal
 */
export const updateSomeAndGet = Debug.dualWithTrace<
  <A>(self: TRef.TRef<A>, f: (a: A) => Option.Option<A>) => STM.STM<never, never, A>,
  <A>(f: (a: A) => Option.Option<A>) => (self: TRef.TRef<A>) => STM.STM<never, never, A>
>(
  2,
  (trace, restore) =>
    (self, f) => self.modify((a) => pipe(restore(f)(a), Option.match(() => [a, a], (b) => [b, b]))).traced(trace)
)

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
export const unsafeGet: {
  <A>(self: TRef.TRef<A>, journal: Journal.Journal): A
  (journal: Journal.Journal): <A>(self: TRef.TRef<A>) => A
} = Debug.dual<
  <A>(self: TRef.TRef<A>, journal: Journal.Journal) => A,
  (journal: Journal.Journal) => <A>(self: TRef.TRef<A>) => A
>(2, <A>(self: TRef.TRef<A>, journal: Journal.Journal) => Entry.unsafeGet(getOrMakeEntry(self, journal)) as A)

/** @internal */
export const unsafeSet = Debug.dual<
  <A>(self: TRef.TRef<A>, value: A, journal: Journal.Journal) => void,
  <A>(value: A, journal: Journal.Journal) => (self: TRef.TRef<A>) => void
>(3, (self, value, journal) => {
  const entry = getOrMakeEntry(self, journal)
  Entry.unsafeSet(entry, value)
  return undefined
})
