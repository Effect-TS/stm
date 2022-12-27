import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as stm from "@effect/stm/internal/stm"
import * as tRef from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TArray from "@effect/stm/TArray"
import type * as TRef from "@effect/stm/TRef"
import * as Order from "@fp-ts/core/typeclass/Order"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Equal from "@fp-ts/data/Equal"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/** @internal */
const TArraySymbolKey = "@effect/stm/TArray"

/** @internal */
export const TArrayTypeId: TArray.TArrayTypeId = Symbol.for(TArraySymbolKey) as TArray.TArrayTypeId

/** @internal */
const tArrayVariance = {
  _A: (_: never) => _
}

/** @internal */
class TArrayImpl<A> implements TArray.TArray<A> {
  readonly [TArrayTypeId] = tArrayVariance
  constructor(readonly chunk: Chunk.Chunk<TRef.TRef<A>>) {}
}

/**
 * @macro traced
 * @internal
 */
export const collectFirst = <A, B>(pf: (a: A) => Option.Option<B>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<B>> =>
    pipe(self, collectFirstSTM((a) => pipe(pf(a), Option.map(core.succeed)))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const collectFirstSTM = <A, R, E, B>(pf: (a: A) => Option.Option<STM.STM<R, E, B>>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, Option.Option<B>> =>
    core.withSTMRuntime((runtime) => {
      let index = 0
      let result: Option.Option<STM.STM<R, E, B>> = Option.none
      while (Option.isNone(result) && index < self.chunk.length) {
        const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(runtime.journal))
        const option = pf(element)
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
}

/**
 * @macro traced
 * @internal
 */
export const contains = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, boolean> =>
    pipe(self, some((a) => Equal.equals(a)(value))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const count = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, number> =>
    pipe(self, reduce(0, (n, a) => predicate(a) ? n + 1 : n)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const countSTM = <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, number> =>
    pipe(
      self,
      reduceSTM(0, (n, a) => pipe(predicate(a), core.map((bool) => bool ? n + 1 : n)))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const empty = <A>(): STM.STM<never, never, TArray.TArray<A>> => {
  const trace = getCallTrace()
  return fromIterable([]).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const every = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, boolean> =>
    pipe(self, some((a) => !predicate(a)), stm.negate).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const everySTM = <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, boolean> =>
    pipe(self, countSTM(predicate), core.map((count) => count === self.chunk.length)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findFirst = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    pipe(self, collectFirst((a) => predicate(a) ? Option.some(a) : Option.none)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findFirstIndex = <A>(value: A, from = 0) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<number>> =>
    pipe(self, findFirstIndexWhere((a) => Equal.equals(a)(value), from)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findFirstIndexWhere = <A>(predicate: Predicate<A>, from = 0) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<number>> => {
    if (from < 0) {
      return stm.succeedNone().traced(trace)
    }
    return core.effect<never, Option.Option<number>>((journal) => {
      let index = from
      let found = false
      while (!found && index < self.chunk.length) {
        const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        found = predicate(element)
        index = index + 1
      }
      if (found) {
        return Option.some(index - 1)
      }
      return Option.none
    }).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const findFirstIndexWhereSTM = <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>, from = 0) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, Option.Option<number>> => {
    /** @macro traced */
    const forIndex = (index: number): STM.STM<R, E, Option.Option<number>> => {
      const trace = getCallTrace()
      if (index < self.chunk.length) {
        return pipe(
          self.chunk,
          Chunk.unsafeGet(index),
          tRef.get,
          core.flatMap(predicate),
          core.flatMap((bool) => bool ? core.succeed(Option.some(index)) : forIndex(index + 1))
        ).traced(trace)
      }
      return stm.succeedNone().traced(trace)
    }
    if (from < 0) {
      return stm.succeedNone().traced(trace)
    }
    return forIndex(from).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const findFirstSTM = <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, Option.Option<A>> => {
    const init = [Option.none as Option.Option<A>, 0 as number] as const
    const cont = (state: readonly [Option.Option<A>, number]) =>
      Option.isNone(state[0]) && state[1] < self.chunk.length - 1
    return pipe(
      stm.iterate(init, cont)((state) => {
        const index = state[1]
        return pipe(
          self.chunk,
          Chunk.unsafeGet(index),
          tRef.get,
          core.flatMap((value) =>
            pipe(
              predicate(value),
              core.map((bool) => [bool ? Option.some(value) : Option.none, index + 1] as const)
            )
          )
        )
      }),
      core.map((state) => state[0])
    ).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const findLast = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    core.effect<never, Option.Option<A>>((journal) => {
      let index = self.chunk.length - 1
      let result: Option.Option<A> = Option.none
      while (Option.isNone(result) && index >= 0) {
        const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        if (predicate(element)) {
          result = Option.some(element)
        }
        index = index - 1
      }
      return result
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const findLastIndex = <A>(value: A, end?: number) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<number>> => {
    const endIndex = end === undefined ? self.chunk.length - 1 : end
    if (endIndex >= self.chunk.length) {
      return stm.succeedNone().traced(trace)
    }
    return core.effect<never, Option.Option<number>>((journal) => {
      let index = endIndex
      let found = false
      while (!found && index >= 0) {
        const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        found = Equal.equals(element)(value)
        index = index - 1
      }
      if (found) {
        return Option.some(index + 1)
      }
      return Option.none
    }).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const findLastSTM = <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, Option.Option<A>> => {
    const init = [Option.none as Option.Option<A>, self.chunk.length - 1] as const
    const cont = (state: readonly [Option.Option<A>, number]) => Option.isNone(state[0]) && state[1] >= 0
    return pipe(
      stm.iterate(init, cont)((state) => {
        const index = state[1]
        return pipe(
          self.chunk,
          Chunk.unsafeGet(index),
          tRef.get,
          core.flatMap((value) =>
            pipe(
              predicate(value),
              core.map((bool) => [bool ? Option.some(value) : Option.none, index - 1] as const)
            )
          )
        )
      }),
      core.map((state) => state[0])
    ).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const forEach = <A, R, E>(f: (value: A) => STM.STM<R, E, void>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, void> =>
    pipe(self, reduceSTM(void 0 as void, (_, a) => f(a))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fromIterable = <A>(iterable: Iterable<A>): STM.STM<never, never, TArray.TArray<A>> => {
  const trace = getCallTrace()
  return pipe(iterable, stm.forEach(tRef.make), core.map((chunk) => new TArrayImpl(chunk))).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const get = (index: number) => {
  const trace = getCallTrace()
  return <A>(self: TArray.TArray<A>): STM.STM<never, never, A> => {
    if (index < 0 || index >= self.chunk.length) {
      return core.dieMessage("Index out of bounds").traced(trace)
    }
    return tRef.get(pipe(self.chunk, Chunk.unsafeGet(index))).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const headOption = <A>(self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return Chunk.isEmpty(self.chunk) ?
    core.succeed(Option.none).traced(trace) :
    pipe(Chunk.unsafeHead(self.chunk), tRef.get, core.map(Option.some)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const lastOption = <A>(self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return Chunk.isEmpty(self.chunk) ?
    stm.succeedNone().traced(trace) :
    pipe(Chunk.unsafeLast(self.chunk), tRef.get, core.map(Option.some)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const make = <Elements extends [any, ...Array<any>]>(
  ...elements: Elements
): STM.STM<never, never, TArray.TArray<Elements[number]>> => {
  const trace = getCallTrace()
  return fromIterable(elements).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const maxOption = <A>(order: Order.Order<A>) => {
  const trace = getCallTrace()
  const greaterThan = Order.greaterThan(order)
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    pipe(self, reduceOption((acc, curr) => greaterThan(acc)(curr) ? curr : acc)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const minOption = <A>(order: Order.Order<A>) => {
  const trace = getCallTrace()
  const lessThan = Order.lessThan(order)
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    pipe(self, reduceOption((acc, curr) => lessThan(acc)(curr) ? curr : acc)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduce = <Z, A>(zero: Z, f: (accumulator: Z, current: A) => Z) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Z> =>
    core.effect<never, Z>((journal) => {
      let index = 0
      let result = zero
      while (index < self.chunk.length) {
        const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        result = f(result, element)
        index = index + 1
      }
      return result
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceOption = <A>(f: (x: A, y: A) => A) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, Option.Option<A>> =>
    core.effect<never, Option.Option<A>>((journal) => {
      let index = 0
      let result: A | undefined = undefined
      while (index < self.chunk.length) {
        const element = pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeGet(journal))
        result = result === undefined ? element : f(result, element)
        index = index + 1
      }
      return Option.fromNullable(result)
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceOptionSTM = <A, R, E>(f: (x: A, y: A) => STM.STM<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, Option.Option<A>> =>
    pipe(
      self,
      reduceSTM(
        Option.none as Option.Option<A>,
        (acc, curr) =>
          Option.isSome(acc) ?
            pipe(f(acc.value, curr), core.map(Option.some)) :
            stm.succeedSome(curr)
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const reduceSTM = <Z, A, R, E>(zero: Z, f: (accumulator: Z, current: A) => STM.STM<R, E, Z>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, Z> =>
    pipe(toChunk(self), core.flatMap(stm.reduce(zero, f))).traced(trace)
}

/** @internal */
export const size = <A>(self: TArray.TArray<A>): number => {
  return self.chunk.length
}

/**
 * @macro traced
 * @internal
 */
export const some = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, boolean> =>
    pipe(self, findFirst(predicate), core.map(Option.isSome)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const someSTM = <A, R, E>(predicate: (value: A) => STM.STM<R, E, boolean>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, boolean> =>
    pipe(self, countSTM(predicate), core.map((n) => n > 0)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const toChunk = <A>(self: TArray.TArray<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return pipe(self.chunk, stm.forEach(tRef.get)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transform = <A>(f: (value: A) => A) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, void> =>
    core.effect<never, void>((journal) => {
      let index = 0
      while (index < self.chunk.length) {
        const ref = pipe(self.chunk, Chunk.unsafeGet(index))
        pipe(ref, tRef.unsafeSet(f(pipe(ref, tRef.unsafeGet(journal))), journal))
        index = index + 1
      }
      return void 0
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const transformSTM = <A, R, E>(f: (value: A) => STM.STM<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, void> =>
    pipe(
      self.chunk,
      stm.forEach((ref) => pipe(tRef.get(ref), core.flatMap(f))),
      core.flatMap((chunk) =>
        core.effect<never, void>((journal) => {
          const iterator = chunk[Symbol.iterator]()
          let index = 0
          let next: IteratorResult<A>
          while ((next = iterator.next()) && !next.done) {
            pipe(self.chunk, Chunk.unsafeGet(index), tRef.unsafeSet(next.value, journal))
            index = index + 1
          }
          return void 0
        })
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const update = <A>(index: number, f: (value: A) => A) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<never, never, void> => {
    if (index < 0 || index >= self.chunk.length) {
      return core.dieMessage("Index out of bounds").traced(trace)
    }
    return pipe(self.chunk, Chunk.unsafeGet(index), tRef.update(f)).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const updateSTM = <A, R, E>(index: number, f: (value: A) => STM.STM<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TArray.TArray<A>): STM.STM<R, E, void> => {
    if (index < 0 || index >= self.chunk.length) {
      return core.dieMessage("Index out of bounds").traced(trace)
    }
    return pipe(
      self.chunk,
      Chunk.unsafeGet(index),
      tRef.get,
      core.flatMap(f),
      core.flatMap((updated) => pipe(self.chunk, Chunk.unsafeGet(index), tRef.set(updated)))
    ).traced(trace)
  }
}
