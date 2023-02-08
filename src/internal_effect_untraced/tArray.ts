import * as Chunk from "@effect/data/Chunk"
import * as Equal from "@effect/data/Equal"
import * as Debug from "@effect/io/Debug"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as stm from "@effect/stm/internal_effect_untraced/stm"
import * as tRef from "@effect/stm/internal_effect_untraced/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TArray from "@effect/stm/TArray"
import type * as TRef from "@effect/stm/TRef"
import { pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import type { Predicate } from "@fp-ts/core/Predicate"
import * as Order from "@fp-ts/core/typeclass/Order"

/** @internal */
const TArraySymbolKey = "@effect/stm/TArray"

/** @internal */
export const TArrayTypeId: TArray.TArrayTypeId = Symbol.for(TArraySymbolKey) as TArray.TArrayTypeId

/** @internal */
const tArrayVariance = {
  _A: (_: never) => _
}

/** @internal */
export class TArrayImpl<A> implements TArray.TArray<A> {
  readonly [TArrayTypeId] = tArrayVariance
  constructor(readonly chunk: Chunk.Chunk<TRef.TRef<A>>) {}
}

/** @internal */
export const collectFirst = Debug.dualWithTrace<
  <A, B>(pf: (a: A) => Option.Option<B>) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<B>>,
  <A, B>(self: TArray.TArray<A>, pf: (a: A) => Option.Option<B>) => STM.STM<never, never, Option.Option<B>>
>(2, (trace, restore) =>
  (self, pf) =>
    collectFirstSTM(
      self,
      (a) => pipe(restore(pf)(a), Option.map(core.succeed))
    ).traced(trace))

/** @internal */
export const collectFirstSTM = Debug.dualWithTrace<
  <A, R, E, B>(
    pf: (a: A) => Option.Option<STM.STM<R, E, B>>
  ) => (
    self: TArray.TArray<A>
  ) => STM.STM<R, E, Option.Option<B>>,
  <A, R, E, B>(
    self: TArray.TArray<A>,
    pf: (a: A) => Option.Option<STM.STM<R, E, B>>
  ) => STM.STM<R, E, Option.Option<B>>
>(
  2,
  (trace, restore) =>
    <A, R, E, B>(self: TArray.TArray<A>, pf: (a: A) => Option.Option<STM.STM<R, E, B>>) =>
      core.withSTMRuntime((runtime) => {
        let index = 0
        let result: Option.Option<STM.STM<R, E, B>> = Option.none()
        while (Option.isNone(result) && index < self.chunk.length) {
          const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(runtime.journal))
          const option = restore(pf)(element)
          if (Option.isSome(option)) {
            result = option
          }
          index = index + 1
        }
        return pipe(
          result,
          Option.match(
            () => stm.succeedNone(),
            core.map(Option.some)
          )
        )
      }).traced(trace)
)

/** @internal */
export const contains = Debug.dualWithTrace<
  <A>(value: A) => (self: TArray.TArray<A>) => STM.STM<never, never, boolean>,
  <A>(self: TArray.TArray<A>, value: A) => STM.STM<never, never, boolean>
>(2, (trace) => (self, value) => some(self, (a) => Equal.equals(a)(value)).traced(trace))

/** @internal */
export const count = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, number>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>) => STM.STM<never, never, number>
>(2, (trace, restore) =>
  (self, predicate) =>
    reduce(
      self,
      0,
      (n, a) => restore(predicate)(a) ? n + 1 : n
    ).traced(trace))

/** @internal */
export const countSTM = Debug.dualWithTrace<
  <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => (self: TArray.TArray<A>) => STM.STM<R, E, number>,
  <A, R, E>(self: TArray.TArray<A>, predicate: (value: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, number>
>(2, (trace, restore) =>
  (self, predicate) =>
    reduceSTM(
      self,
      0,
      (n, a) => core.map(restore(predicate)(a), (bool) => bool ? n + 1 : n)
    ).traced(trace))

/** @internal */
export const empty = Debug.methodWithTrace((trace) =>
  <A>(): STM.STM<never, never, TArray.TArray<A>> => fromIterable([]).traced(trace)
)

/** @internal */
export const every = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, boolean>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>) => STM.STM<never, never, boolean>
>(2, (trace, restore) => (self, predicate) => stm.negate(some(self, (a) => !restore(predicate)(a))).traced(trace))

/** @internal */
export const everySTM = Debug.dualWithTrace<
  <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => (self: TArray.TArray<A>) => STM.STM<R, E, boolean>,
  <A, R, E>(self: TArray.TArray<A>, predicate: (value: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, boolean>
>(2, (trace, restore) =>
  (self, predicate) =>
    core.map(
      countSTM(self, restore(predicate)),
      (count) => count === self.chunk.length
    ).traced(trace))

/** @internal */
export const findFirst = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<A>>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>) => STM.STM<never, never, Option.Option<A>>
>(2, (trace, restore) =>
  (self, predicate) =>
    collectFirst(self, (a) =>
      restore(predicate)(a)
        ? Option.some(a)
        : Option.none()).traced(trace))

/** @internal */
export const findFirstIndex = Debug.dualWithTrace<
  <A>(value: A) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<number>>,
  <A>(self: TArray.TArray<A>, value: A) => STM.STM<never, never, Option.Option<number>>
>(2, (trace) => (self, value) => findFirstIndexFrom(self, value, 0).traced(trace))

/** @internal */
export const findFirstIndexFrom = Debug.dualWithTrace<
  <A>(value: A, from: number) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<number>>,
  <A>(self: TArray.TArray<A>, value: A, from: number) => STM.STM<never, never, Option.Option<number>>
>(3, (trace) =>
  (self, value, from) =>
    findFirstIndexWhereFrom(
      self,
      (a) => Equal.equals(a)(value),
      from
    ).traced(trace))

/** @internal */
export const findFirstIndexWhere = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<number>>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>) => STM.STM<never, never, Option.Option<number>>
>(2, (trace, restore) => (self, predicate) => findFirstIndexWhereFrom(self, restore(predicate), 0).traced(trace))

/** @internal */
export const findFirstIndexWhereFrom = Debug.dualWithTrace<
  <A>(
    predicate: Predicate<A>,
    from: number
  ) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<number>>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>, from: number) => STM.STM<never, never, Option.Option<number>>
>(3, (trace, restore) =>
  (self, predicate, from) => {
    if (from < 0) {
      return stm.succeedNone().traced(trace)
    }
    return core.effect<never, Option.Option<number>>((journal) => {
      let index: number = from
      let found = false
      while (!found && index < self.chunk.length) {
        const element = tRef.unsafeGet(Chunk.unsafeGet(self.chunk, index), journal)
        found = restore(predicate)(element)
        index = index + 1
      }
      if (found) {
        return Option.some(index - 1)
      }
      return Option.none()
    }).traced(trace)
  })

/** @internal */
export const findFirstIndexWhereSTM = Debug.dualWithTrace<
  <A, R, E>(
    predicate: (value: A) => STM.STM<R, E, boolean>
  ) => (self: TArray.TArray<A>) => STM.STM<R, E, Option.Option<number>>,
  <A, R, E>(
    self: TArray.TArray<A>,
    predicate: (value: A) => STM.STM<R, E, boolean>
  ) => STM.STM<R, E, Option.Option<number>>
>(2, (trace, restore) => (self, predicate) => findFirstIndexWhereFromSTM(self, restore(predicate), 0).traced(trace))

/** @internal */
export const findFirstIndexWhereFromSTM = Debug.dualWithTrace<
  <A, R, E>(
    predicate: (value: A) => STM.STM<R, E, boolean>,
    from: number
  ) => (self: TArray.TArray<A>) => STM.STM<R, E, Option.Option<number>>,
  <A, R, E>(
    self: TArray.TArray<A>,
    predicate: (value: A) => STM.STM<R, E, boolean>,
    from: number
  ) => STM.STM<R, E, Option.Option<number>>
>(3, (trace, restore) =>
  <A, R, E>(
    self: TArray.TArray<A>,
    predicate: (value: A) => STM.STM<R, E, boolean>,
    from: number
  ) => {
    const forIndex = (index: number): STM.STM<R, E, Option.Option<number>> =>
      index < self.chunk.length
        ? pipe(
          tRef.get(Chunk.unsafeGet(self.chunk, index)),
          core.flatMap(restore(predicate)),
          core.flatMap((bool) =>
            bool ?
              core.succeed(Option.some(index)) :
              forIndex(index + 1)
          )
        )
        : stm.succeedNone()
    return from < 0
      ? stm.succeedNone().traced(trace)
      : forIndex(from).traced(trace)
  })

/** @internal */
export const findFirstSTM = Debug.dualWithTrace<
  <A, R, E>(
    predicate: (value: A) => STM.STM<R, E, boolean>
  ) => (
    self: TArray.TArray<A>
  ) => STM.STM<R, E, Option.Option<A>>,
  <A, R, E>(
    self: TArray.TArray<A>,
    predicate: (value: A) => STM.STM<R, E, boolean>
  ) => STM.STM<R, E, Option.Option<A>>
>(2, (trace, restore) =>
  <A, R, E>(self: TArray.TArray<A>, predicate: (value: A) => STM.STM<R, E, boolean>) => {
    const init = [Option.none() as Option.Option<A>, 0 as number] as const
    const cont = (state: readonly [Option.Option<A>, number]) =>
      Option.isNone(state[0]) && state[1] < self.chunk.length - 1
    return core.map(
      stm.iterate(init, cont, (state) => {
        const index = state[1]
        return pipe(
          tRef.get(Chunk.unsafeGet(self.chunk, index)),
          core.flatMap((value) =>
            core.map(
              restore(predicate)(value),
              (bool) => [bool ? Option.some(value) : Option.none(), index + 1] as const
            )
          )
        )
      }),
      (state) => state[0]
    ).traced(trace)
  })

/** @internal */
export const findLast = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<A>>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>) => STM.STM<never, never, Option.Option<A>>
>(
  2,
  (trace, restore) =>
    <A>(self: TArray.TArray<A>, predicate: Predicate<A>) =>
      core.effect<never, Option.Option<A>>((journal) => {
        let index = self.chunk.length - 1
        let result: Option.Option<A> = Option.none()
        while (Option.isNone(result) && index >= 0) {
          const element = tRef.unsafeGet(Chunk.unsafeGet(self.chunk, index), journal)
          if (restore(predicate)(element)) {
            result = Option.some(element)
          }
          index = index - 1
        }
        return result
      }).traced(trace)
)

/** @internal */
export const findLastIndex = Debug.dualWithTrace<
  <A>(value: A) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<number>>,
  <A>(self: TArray.TArray<A>, value: A) => STM.STM<never, never, Option.Option<number>>
>(2, (trace) => (self, value) => findLastIndexFrom(self, value, self.chunk.length - 1).traced(trace))

/** @internal */
export const findLastIndexFrom = Debug.dualWithTrace<
  <A>(value: A, end: number) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<number>>,
  <A>(self: TArray.TArray<A>, value: A, end: number) => STM.STM<never, never, Option.Option<number>>
>(3, (trace) =>
  (self, value, end) => {
    if (end >= self.chunk.length) {
      return stm.succeedNone().traced(trace)
    }
    return core.effect<never, Option.Option<number>>((journal) => {
      let index: number = end
      let found = false
      while (!found && index >= 0) {
        const element = tRef.unsafeGet(Chunk.unsafeGet(self.chunk, index), journal)
        found = Equal.equals(element)(value)
        index = index - 1
      }
      if (found) {
        return Option.some(index + 1)
      }
      return Option.none()
    }).traced(trace)
  })

/** @internal */
export const findLastSTM = Debug.dualWithTrace<
  <A, R, E>(
    predicate: (value: A) => STM.STM<R, E, boolean>
  ) => (self: TArray.TArray<A>) => STM.STM<R, E, Option.Option<A>>,
  <A, R, E>(
    self: TArray.TArray<A>,
    predicate: (value: A) => STM.STM<R, E, boolean>
  ) => STM.STM<R, E, Option.Option<A>>
>(2, (trace, restore) =>
  <A, R, E>(self: TArray.TArray<A>, predicate: (value: A) => STM.STM<R, E, boolean>) => {
    const init = [Option.none() as Option.Option<A>, self.chunk.length - 1] as const
    const cont = (state: readonly [Option.Option<A>, number]) => Option.isNone(state[0]) && state[1] >= 0
    return core.map(
      stm.iterate(init, cont, (state) => {
        const index = state[1]
        return pipe(
          tRef.get(Chunk.unsafeGet(self.chunk, index)),
          core.flatMap((value) =>
            core.map(
              restore(predicate)(value),
              (bool) => [bool ? Option.some(value) : Option.none(), index - 1] as const
            )
          )
        )
      }),
      (state) => state[0]
    ).traced(trace)
  })

/** @internal */
export const forEach = Debug.dualWithTrace<
  <A, R, E>(f: (value: A) => STM.STM<R, E, void>) => (self: TArray.TArray<A>) => STM.STM<R, E, void>,
  <A, R, E>(self: TArray.TArray<A>, f: (value: A) => STM.STM<R, E, void>) => STM.STM<R, E, void>
>(2, (trace, restore) => (self, f) => reduceSTM(self, void 0 as void, (_, a) => restore(f)(a)).traced(trace))

/** @internal */
export const fromIterable = Debug.methodWithTrace((trace) =>
  <A>(iterable: Iterable<A>): STM.STM<never, never, TArray.TArray<A>> =>
    core.map(
      stm.forEach(iterable, tRef.make),
      (chunk) => new TArrayImpl(chunk)
    ).traced(trace)
)

/** @internal */
export const get = Debug.dualWithTrace<
  (index: number) => <A>(self: TArray.TArray<A>) => STM.STM<never, never, A>,
  <A>(self: TArray.TArray<A>, index: number) => STM.STM<never, never, A>
>(2, (trace) =>
  (self, index) => {
    if (index < 0 || index >= self.chunk.length) {
      return core.dieMessage("Index out of bounds").traced(trace)
    }
    return tRef.get(Chunk.unsafeGet(self.chunk, index)).traced(trace)
  })

/** @internal */
export const headOption = Debug.methodWithTrace((trace) =>
  <A>(self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    Chunk.isEmpty(self.chunk) ?
      core.succeed(Option.none()).traced(trace) :
      core.map(tRef.get(Chunk.unsafeHead(self.chunk)), Option.some).traced(trace)
)

/** @internal */
export const lastOption = Debug.methodWithTrace((trace) =>
  <A>(self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    Chunk.isEmpty(self.chunk) ?
      stm.succeedNone().traced(trace) :
      core.map(tRef.get(Chunk.unsafeLast(self.chunk)), Option.some).traced(trace)
)

/** @internal */
export const make = Debug.methodWithTrace((trace) =>
  <Elements extends [any, ...Array<any>]>(
    ...elements: Elements
  ): STM.STM<never, never, TArray.TArray<Elements[number]>> => fromIterable(elements).traced(trace)
)

/** @internal */
export const maxOption = Debug.dualWithTrace<
  <A>(order: Order.Order<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<A>>,
  <A>(self: TArray.TArray<A>, order: Order.Order<A>) => STM.STM<never, never, Option.Option<A>>
>(2, (trace) =>
  (self, order) => {
    const greaterThan = Order.greaterThan(order)
    return reduceOption(self, (acc, curr) => greaterThan(acc)(curr) ? curr : acc).traced(trace)
  })

/** @internal */
export const minOption = Debug.dualWithTrace<
  <A>(order: Order.Order<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<A>>,
  <A>(self: TArray.TArray<A>, order: Order.Order<A>) => STM.STM<never, never, Option.Option<A>>
>(2, (trace) =>
  (self, order) => {
    const lessThan = Order.lessThan(order)
    return reduceOption(self, (acc, curr) => lessThan(acc)(curr) ? curr : acc).traced(trace)
  })

/** @internal */
export const reduce = Debug.dualWithTrace<
  <Z, A>(zero: Z, f: (accumulator: Z, current: A) => Z) => (self: TArray.TArray<A>) => STM.STM<never, never, Z>,
  <Z, A>(self: TArray.TArray<A>, zero: Z, f: (accumulator: Z, current: A) => Z) => STM.STM<never, never, Z>
>(
  3,
  (trace, restore) =>
    <Z, A>(self: TArray.TArray<A>, zero: Z, f: (accumulator: Z, current: A) => Z) =>
      core.effect<never, Z>((journal) => {
        let index = 0
        let result = zero
        while (index < self.chunk.length) {
          const element = tRef.unsafeGet(Chunk.unsafeGet(self.chunk, index), journal)
          result = restore(f)(result, element)
          index = index + 1
        }
        return result
      }).traced(trace)
)

/** @internal */
export const reduceOption = Debug.dualWithTrace<
  <A>(f: (x: A, y: A) => A) => (self: TArray.TArray<A>) => STM.STM<never, never, Option.Option<A>>,
  <A>(self: TArray.TArray<A>, f: (x: A, y: A) => A) => STM.STM<never, never, Option.Option<A>>
>(
  2,
  (trace, restore) =>
    <A>(self: TArray.TArray<A>, f: (x: A, y: A) => A) =>
      core.effect<never, Option.Option<A>>((journal) => {
        let index = 0
        let result: A | undefined = undefined
        while (index < self.chunk.length) {
          const element = tRef.unsafeGet(Chunk.unsafeGet(self.chunk, index), journal)
          result = result === undefined ? element : restore(f)(result, element)
          index = index + 1
        }
        return Option.fromNullable(result)
      }).traced(trace)
)

/** @internal */
export const reduceOptionSTM = Debug.dualWithTrace<
  <A, R, E>(f: (x: A, y: A) => STM.STM<R, E, A>) => (self: TArray.TArray<A>) => STM.STM<R, E, Option.Option<A>>,
  <A, R, E>(self: TArray.TArray<A>, f: (x: A, y: A) => STM.STM<R, E, A>) => STM.STM<R, E, Option.Option<A>>
>(
  2,
  (trace, restore) =>
    <A, R, E>(self: TArray.TArray<A>, f: (x: A, y: A) => STM.STM<R, E, A>) =>
      reduceSTM(self, Option.none<A>(), (acc, curr) =>
        Option.isSome(acc)
          ? core.map(restore(f)(acc.value, curr), Option.some)
          : stm.succeedSome(curr)).traced(trace)
)

/** @internal */
export const reduceSTM = Debug.dualWithTrace<
  <Z, A, R, E>(
    zero: Z,
    f: (accumulator: Z, current: A) => STM.STM<R, E, Z>
  ) => (self: TArray.TArray<A>) => STM.STM<R, E, Z>,
  <Z, A, R, E>(
    self: TArray.TArray<A>,
    zero: Z,
    f: (accumulator: Z, current: A) => STM.STM<R, E, Z>
  ) => STM.STM<R, E, Z>
>(3, (trace, restore) =>
  (self, zero, f) =>
    core.flatMap(
      toChunk(self),
      stm.reduce(zero, restore(f))
    ).traced(trace))

/** @internal */
export const size = <A>(self: TArray.TArray<A>): number => self.chunk.length

/** @internal */
export const some = Debug.dualWithTrace<
  <A>(predicate: Predicate<A>) => (self: TArray.TArray<A>) => STM.STM<never, never, boolean>,
  <A>(self: TArray.TArray<A>, predicate: Predicate<A>) => STM.STM<never, never, boolean>
>(2, (trace, restore) =>
  (self, predicate) =>
    core.map(
      findFirst(self, restore(predicate)),
      Option.isSome
    ).traced(trace))

/** @internal */
export const someSTM = Debug.dualWithTrace<
  <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => (self: TArray.TArray<A>) => STM.STM<R, E, boolean>,
  <A, R, E>(self: TArray.TArray<A>, predicate: (value: A) => STM.STM<R, E, boolean>) => STM.STM<R, E, boolean>
>(2, (trace, restore) => (self, predicate) => core.map(countSTM(self, restore(predicate)), (n) => n > 0).traced(trace))

/** @internal */
export const toChunk = Debug.methodWithTrace((trace) =>
  <A>(self: TArray.TArray<A>): STM.STM<never, never, Chunk.Chunk<A>> => stm.forEach(self.chunk, tRef.get).traced(trace)
)

/** @internal */
export const transform = Debug.dualWithTrace<
  <A>(f: (value: A) => A) => (self: TArray.TArray<A>) => STM.STM<never, never, void>,
  <A>(self: TArray.TArray<A>, f: (value: A) => A) => STM.STM<never, never, void>
>(2, (trace, restore) =>
  (self, f) =>
    core.effect<never, void>((journal) => {
      let index = 0
      while (index < self.chunk.length) {
        const ref = pipe(self.chunk, Chunk.unsafeGet(index))
        tRef.unsafeSet(ref, restore(f)(tRef.unsafeGet(ref, journal)), journal)
        index = index + 1
      }
      return void 0
    }).traced(trace))

/** @internal */
export const transformSTM = Debug.dualWithTrace<
  <A, R, E>(f: (value: A) => STM.STM<R, E, A>) => (self: TArray.TArray<A>) => STM.STM<R, E, void>,
  <A, R, E>(self: TArray.TArray<A>, f: (value: A) => STM.STM<R, E, A>) => STM.STM<R, E, void>
>(2, (trace, restore) =>
  <A, R, E>(self: TArray.TArray<A>, f: (value: A) => STM.STM<R, E, A>) =>
    core.flatMap(
      stm.forEach(
        self.chunk,
        (ref) => core.flatMap(tRef.get(ref), restore(f))
      ),
      (chunk) =>
        core.effect<never, void>((journal) => {
          const iterator = chunk[Symbol.iterator]()
          let index = 0
          let next: IteratorResult<A>
          while ((next = iterator.next()) && !next.done) {
            tRef.unsafeSet(Chunk.unsafeGet(self.chunk, index), next.value, journal)
            index = index + 1
          }
          return void 0
        })
    ).traced(trace))

/** @internal */
export const update = Debug.dualWithTrace<
  <A>(index: number, f: (value: A) => A) => (self: TArray.TArray<A>) => STM.STM<never, never, void>,
  <A>(self: TArray.TArray<A>, index: number, f: (value: A) => A) => STM.STM<never, never, void>
>(3, (trace, restore) =>
  (self, index, f) => {
    if (index < 0 || index >= self.chunk.length) {
      return core.dieMessage("Index out of bounds").traced(trace)
    }
    return tRef.update(Chunk.unsafeGet(self.chunk, index), restore(f)).traced(trace)
  })

/** @internal */
export const updateSTM = Debug.dualWithTrace<
  <A, R, E>(index: number, f: (value: A) => STM.STM<R, E, A>) => (self: TArray.TArray<A>) => STM.STM<R, E, void>,
  <A, R, E>(self: TArray.TArray<A>, index: number, f: (value: A) => STM.STM<R, E, A>) => STM.STM<R, E, void>
>(3, (trace, restore) =>
  (self, index, f) => {
    if (index < 0 || index >= self.chunk.length) {
      return core.dieMessage("Index out of bounds").traced(trace)
    }
    return pipe(
      tRef.get(Chunk.unsafeGet(self.chunk, index)),
      core.flatMap(restore(f)),
      core.flatMap((updated) => tRef.set(Chunk.unsafeGet(self.chunk, index), updated))
    ).traced(trace)
  })
