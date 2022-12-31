import { getCallTrace } from "@effect/io/Debug"
import * as Layer from "@effect/io/Layer"
import * as core from "@effect/stm/internal/core"
import * as stm from "@effect/stm/internal/stm"
import * as tArray from "@effect/stm/internal/tArray"
import * as tRef from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TArray from "@effect/stm/TArray"
import type * as TRandom from "@effect/stm/TRandom"
import type * as TRef from "@effect/stm/TRef"
import type * as Chunk from "@fp-ts/data/Chunk"
import * as Context from "@fp-ts/data/Context"
import { pipe } from "@fp-ts/data/Function"
import * as Random from "@fp-ts/data/Random"

/** @internal */
const TRandomSymbolKey = "@effect/stm/TRandom"

/** @internal */
export const TRandomTypeId: TRandom.TRandomTypeId = Symbol.for(
  TRandomSymbolKey
) as TRandom.TRandomTypeId

/** @internal */
const randomInteger = (state: Random.PCGRandomState): readonly [number, Random.PCGRandomState] => {
  const prng = new Random.PCGRandom()
  prng.setState(state)
  return [prng.integer(0), prng.getState()]
}

/** @internal */
const randomIntegerBetween = (low: number, high: number) => {
  return (state: Random.PCGRandomState): readonly [number, Random.PCGRandomState] => {
    const prng = new Random.PCGRandom()
    prng.setState(state)
    return [prng.integer(high - low) + low, prng.getState()]
  }
}

/** @internal */
const randomNumber = (state: Random.PCGRandomState): readonly [number, Random.PCGRandomState] => {
  const prng = new Random.PCGRandom()
  prng.setState(state)
  return [prng.number(), prng.getState()]
}

/**
 * @macro traced
 * @internal
 */
const withState = <A>(
  state: TRef.TRef<Random.PCGRandomState>,
  f: (state: Random.PCGRandomState) => readonly [A, Random.PCGRandomState]
): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  return pipe(state, tRef.modify(f)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
const shuffleWith = <A>(
  iterable: Iterable<A>,
  nextIntBounded: (n: number) => STM.STM<never, never, number>
): STM.STM<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  /**
   * @macro traced
   */
  const swap = (buffer: TArray.TArray<A>, index1: number, index2: number): STM.STM<never, never, void> => {
    const trace = getCallTrace()
    return pipe(
      buffer,
      tArray.get(index1),
      core.flatMap((tmp) =>
        pipe(
          buffer,
          tArray.updateSTM(index1, () => pipe(buffer, tArray.get(index2))),
          core.zipRight(
            pipe(
              buffer,
              tArray.update(index2, () => tmp)
            )
          )
        )
      )
    ).traced(trace)
  }
  return pipe(
    tArray.fromIterable(iterable),
    core.flatMap((buffer) => {
      const array: Array<number> = []
      for (let i = array.length; i >= 2; i = i - 1) {
        array.push(i)
      }
      return pipe(
        array,
        stm.forEachDiscard((n) => pipe(nextIntBounded(n), core.flatMap((k) => swap(buffer, n - 1, k)))),
        core.zipRight(tArray.toChunk(buffer))
      )
    })
  ).traced(trace)
}

/** @internal */
export const Tag: Context.Tag<TRandom.TRandom> = Context.Tag<TRandom.TRandom>()

/** @internal */
class TRandomImpl implements TRandom.TRandom {
  readonly [TRandomTypeId]: TRandom.TRandomTypeId = TRandomTypeId
  constructor(readonly state: TRef.TRef<Random.PCGRandomState>) {}
  next(): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return withState(this.state, randomNumber).traced(trace)
  }
  nextBoolean(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(
      this.next(),
      core.flatMap((n) => core.succeed(n > 0.5))
    ).traced(trace)
  }
  nextInt(): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return withState(this.state, randomInteger).traced(trace)
  }
  nextRange(min: number, max: number): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return pipe(
      this.next(),
      core.flatMap((n) => core.succeed((max - min) * n + min))
    ).traced(trace)
  }
  nextIntBetween(low: number, high: number): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return withState(this.state, randomIntegerBetween(low, high)).traced(trace)
  }
  shuffle<A>(elements: Iterable<A>): STM.STM<never, never, Chunk.Chunk<A>> {
    const trace = getCallTrace()
    return shuffleWith(elements, (n) => this.nextIntBetween(0, n)).traced(trace)
  }
}

/** @internal */
export const live = (): Layer.Layer<never, never, TRandom.TRandom> =>
  Layer.fromEffect(Tag)(pipe(
    tRef.make(new Random.PCGRandom((Math.random() * 4294967296) >>> 0).getState()),
    core.map((seed) => new TRandomImpl(seed)),
    core.commit
  ))

/**
 * @macro traced
 * @internal
 */
export const next = (): STM.STM<TRandom.TRandom, never, number> => {
  const trace = getCallTrace()
  return stm.serviceWithSTM(Tag)((random) => random.next()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const nextBoolean = (): STM.STM<TRandom.TRandom, never, boolean> => {
  const trace = getCallTrace()
  return stm.serviceWithSTM(Tag)((random) => random.nextBoolean()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const nextInt = (): STM.STM<TRandom.TRandom, never, number> => {
  const trace = getCallTrace()
  return stm.serviceWithSTM(Tag)((random) => random.nextInt()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const nextIntBetween = (low: number, high: number): STM.STM<TRandom.TRandom, never, number> => {
  const trace = getCallTrace()
  return stm.serviceWithSTM(Tag)((random) => random.nextIntBetween(low, high)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const nextRange = (min: number, max: number): STM.STM<TRandom.TRandom, never, number> => {
  const trace = getCallTrace()
  return stm.serviceWithSTM(Tag)((random) => random.nextRange(min, max)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const shuffle = <A>(elements: Iterable<A>): STM.STM<TRandom.TRandom, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return stm.serviceWithSTM(Tag)((random) => random.shuffle(elements)).traced(trace)
}
