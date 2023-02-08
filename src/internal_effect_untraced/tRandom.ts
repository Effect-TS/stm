import type * as Chunk from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"
import * as Random from "@effect/data/Random"
import * as Debug from "@effect/io/Debug"
import * as Layer from "@effect/io/Layer"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as stm from "@effect/stm/internal_effect_untraced/stm"
import * as tArray from "@effect/stm/internal_effect_untraced/tArray"
import * as tRef from "@effect/stm/internal_effect_untraced/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TArray from "@effect/stm/TArray"
import type * as TRandom from "@effect/stm/TRandom"
import type * as TRef from "@effect/stm/TRef"
import { pipe } from "@fp-ts/core/Function"

const TRandomSymbolKey = "@effect/stm/TRandom"

/** @internal */
export const TRandomTypeId: TRandom.TRandomTypeId = Symbol.for(
  TRandomSymbolKey
) as TRandom.TRandomTypeId

const randomInteger = (state: Random.PCGRandomState): readonly [number, Random.PCGRandomState] => {
  const prng = new Random.PCGRandom()
  prng.setState(state)
  return [prng.integer(0), prng.getState()]
}

const randomIntegerBetween = (low: number, high: number) => {
  return (state: Random.PCGRandomState): readonly [number, Random.PCGRandomState] => {
    const prng = new Random.PCGRandom()
    prng.setState(state)
    return [prng.integer(high - low) + low, prng.getState()]
  }
}

const randomNumber = (state: Random.PCGRandomState): readonly [number, Random.PCGRandomState] => {
  const prng = new Random.PCGRandom()
  prng.setState(state)
  return [prng.number(), prng.getState()]
}

const withState = <A>(
  state: TRef.TRef<Random.PCGRandomState>,
  f: (state: Random.PCGRandomState) => readonly [A, Random.PCGRandomState]
): STM.STM<never, never, A> => {
  return pipe(state, tRef.modify(f))
}

const shuffleWith = <A>(
  iterable: Iterable<A>,
  nextIntBounded: (n: number) => STM.STM<never, never, number>
): STM.STM<never, never, Chunk.Chunk<A>> => {
  const swap = (buffer: TArray.TArray<A>, index1: number, index2: number): STM.STM<never, never, void> =>
    pipe(
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
    )
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
  )
}

/** @internal */
export const Tag: Context.Tag<TRandom.TRandom> = Context.Tag<TRandom.TRandom>()

class TRandomImpl implements TRandom.TRandom {
  readonly [TRandomTypeId]: TRandom.TRandomTypeId = TRandomTypeId
  constructor(readonly state: TRef.TRef<Random.PCGRandomState>) {}
  next(): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) => withState(this.state, randomNumber).traced(trace))
  }
  nextBoolean(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.flatMap(this.next(), (n) => core.succeed(n > 0.5)).traced(trace))
  }
  nextInt(): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) => withState(this.state, randomInteger).traced(trace))
  }
  nextRange(min: number, max: number): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) =>
      core.flatMap(this.next(), (n) => core.succeed((max - min) * n + min)).traced(trace)
    )
  }
  nextIntBetween(low: number, high: number): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) => withState(this.state, randomIntegerBetween(low, high)).traced(trace))
  }
  shuffle<A>(elements: Iterable<A>): STM.STM<never, never, Chunk.Chunk<A>> {
    return Debug.bodyWithTrace((trace) => shuffleWith(elements, (n) => this.nextIntBetween(0, n)).traced(trace))
  }
}

/** @internal */
export const live = Debug.methodWithTrace((trace) =>
  (): Layer.Layer<never, never, TRandom.TRandom> =>
    Layer.effect(
      Tag,
      pipe(
        tRef.make(new Random.PCGRandom((Math.random() * 4294967296) >>> 0).getState()),
        core.map((seed) => new TRandomImpl(seed)),
        core.commit
      ).traced(trace)
    )
)

/** @internal */
export const next = Debug.methodWithTrace((trace) =>
  (): STM.STM<TRandom.TRandom, never, number> => stm.serviceWithSTM(Tag, (random) => random.next()).traced(trace)
)

/** @internal */
export const nextBoolean = Debug.methodWithTrace((trace) =>
  (): STM.STM<TRandom.TRandom, never, boolean> =>
    stm.serviceWithSTM(Tag, (random) => random.nextBoolean()).traced(trace)
)

/** @internal */
export const nextInt = Debug.methodWithTrace((trace) =>
  (): STM.STM<TRandom.TRandom, never, number> => stm.serviceWithSTM(Tag, (random) => random.nextInt()).traced(trace)
)

/** @internal */
export const nextIntBetween = Debug.methodWithTrace((trace) =>
  (low: number, high: number): STM.STM<TRandom.TRandom, never, number> =>
    stm.serviceWithSTM(Tag, (random) => random.nextIntBetween(low, high)).traced(trace)
)

/** @internal */
export const nextRange = Debug.methodWithTrace((trace) =>
  (min: number, max: number): STM.STM<TRandom.TRandom, never, number> =>
    stm.serviceWithSTM(Tag, (random) => random.nextRange(min, max)).traced(trace)
)

/** @internal */
export const shuffle = Debug.methodWithTrace((trace) =>
  <A>(elements: Iterable<A>): STM.STM<TRandom.TRandom, never, Chunk.Chunk<A>> =>
    stm.serviceWithSTM(Tag, (random) => random.shuffle(elements)).traced(trace)
)
