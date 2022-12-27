import { getCallTrace } from "@effect/io/Debug"
import * as core from "@effect/stm/internal/core"
import * as OpCodes from "@effect/stm/internal/opCodes/strategy"
import * as stm from "@effect/stm/internal/stm"
import * as tRef from "@effect/stm/internal/tRef"
import * as STM from "@effect/stm/STM"
import type * as TQueue from "@effect/stm/TQueue"
import type * as TRef from "@effect/stm/TRef"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/** @internal */
const TEnqueueSymbolKey = "@effect/stm/TQueue/TEnqueue"

/** @internal */
export const TEnqueueTypeId: TQueue.TEnqueueTypeId = Symbol.for(TEnqueueSymbolKey) as TQueue.TEnqueueTypeId

/** @internal */
const TDequeueSymbolKey = "@effect/stm/TQueue/TDequeue"

/** @internal */
export const TDequeueTypeId: TQueue.TDequeueTypeId = Symbol.for(TDequeueSymbolKey) as TQueue.TDequeueTypeId

/**
 * A `Strategy` describes how the queue will handle values if the queue is at
 * capacity.
 *
 * @internal
 */
export type TQueueStrategy = BackPressure | Dropping | Sliding

/**
 * A strategy that retries if the queue is at capacity.
 *
 * @internal
 */
export interface BackPressure {
  readonly op: OpCodes.OP_BACKPRESSURE_STRATEGY
}

/**
 * A strategy that drops new values if the queue is at capacity.
 *
 * @internal
 */
export interface Dropping {
  readonly op: OpCodes.OP_DROPPING_STRATEGY
}

/**
 * A strategy that drops old values if the queue is at capacity.
 *
 * @internal
 */
export interface Sliding {
  readonly op: OpCodes.OP_SLIDING_STRATEGY
}

/** @internal */
export const BackPressure: TQueueStrategy = {
  op: OpCodes.OP_BACKPRESSURE_STRATEGY
}

/** @internal */
export const Dropping: TQueueStrategy = {
  op: OpCodes.OP_DROPPING_STRATEGY
}

/** @internal */
export const Sliding: TQueueStrategy = {
  op: OpCodes.OP_SLIDING_STRATEGY
}

/** @internal */
export const tDequeueVariance = {
  _Out: (_: never) => _
}

/** @internal */
export const tEnqueueVariance = {
  _In: (_: unknown) => _
}

/** @internal */
class TQueueImpl<A> implements TQueue.TQueue<A> {
  readonly [TDequeueTypeId] = tDequeueVariance
  readonly [TEnqueueTypeId] = tEnqueueVariance
  constructor(
    readonly ref: TRef.TRef<Array<A> | undefined>,
    readonly requestedCapacity: number,
    readonly strategy: TQueueStrategy
  ) {}

  capacity(): number {
    return this.requestedCapacity
  }

  size(): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return STM.interruptWith(runtime.fiberId)
      }
      return core.succeed(queue.length)
    }).traced(trace)
  }

  isFull(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(this.size(), core.map((size) => size === this.requestedCapacity)).traced(trace)
  }

  isEmpty(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(this.size(), core.map((size) => size === 0)).traced(trace)
  }

  shutdown(): STM.STM<never, never, void> {
    const trace = getCallTrace()
    return core.withSTMRuntime<never, never, void>((runtime) => {
      pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>(void 0, runtime.journal))
      return stm.unit()
    }).traced(trace)
  }

  isShutdown(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return core.effect<never, boolean>((journal) => {
      const queue = pipe(this.ref, tRef.unsafeGet(journal))
      return queue === undefined
    }).traced(trace)
  }

  awaitShutdown(): STM.STM<never, never, void> {
    const trace = getCallTrace()
    return pipe(
      this.isShutdown(),
      core.flatMap((isShutdown) => isShutdown ? stm.unit() : core.retry())
    ).traced(trace)
  }

  offer(value: A): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      if (queue.length < this.requestedCapacity) {
        queue.push(value)
        pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>(queue, runtime.journal))
        return core.succeed(true)
      }
      switch (this.strategy.op) {
        case OpCodes.OP_BACKPRESSURE_STRATEGY: {
          return core.retry()
        }
        case OpCodes.OP_DROPPING_STRATEGY: {
          return core.succeed(false)
        }
        case OpCodes.OP_SLIDING_STRATEGY: {
          const dequeued = queue.shift()
          if (dequeued === undefined) {
            return core.succeed(true)
          }
          queue.push(value)
          pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>(queue, runtime.journal))
          return core.succeed(true)
        }
      }
    }).traced(trace)
  }

  offerAll(iterable: Iterable<A>): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const as = Array.from(iterable)
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      if (queue.length + as.length <= this.requestedCapacity) {
        pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>([...queue, ...as], runtime.journal))
        return core.succeed(true)
      }
      switch (this.strategy.op) {
        case OpCodes.OP_BACKPRESSURE_STRATEGY: {
          return core.retry()
        }
        case OpCodes.OP_DROPPING_STRATEGY: {
          const forQueue = as.slice(0, this.requestedCapacity - queue.length)
          pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>([...queue, ...forQueue], runtime.journal))
          return core.succeed(false)
        }
        case OpCodes.OP_SLIDING_STRATEGY: {
          const forQueue = as.slice(0, this.requestedCapacity - queue.length)
          const toDrop = queue.length + forQueue.length - this.requestedCapacity
          const newQueue = queue.slice(toDrop)
          pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>([...newQueue, ...forQueue], runtime.journal))
          return core.succeed(true)
        }
      }
    }).traced(trace)
  }

  peek(): STM.STM<never, never, A> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      const head = queue[0]
      if (head === undefined) {
        return core.retry()
      }
      return core.succeed(head)
    }).traced(trace)
  }

  peekOption(): STM.STM<never, never, Option.Option<A>> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      return core.succeed(Option.fromNullable(queue[0]))
    }).traced(trace)
  }

  take(): STM.STM<never, never, A> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      const dequeued = queue.shift()
      if (dequeued === undefined) {
        return core.retry()
      }
      pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>(queue, runtime.journal))
      return core.succeed(dequeued)
    }).traced(trace)
  }

  takeAll(): STM.STM<never, never, Chunk.Chunk<A>> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>([], runtime.journal))
      return core.succeed(Chunk.unsafeFromArray(queue))
    }).traced(trace)
  }

  takeUpTo(max: number): STM.STM<never, never, Chunk.Chunk<A>> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const queue = pipe(this.ref, tRef.unsafeGet(runtime.journal))
      if (queue === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      const [toTake, remaining] = pipe(Chunk.unsafeFromArray(queue), Chunk.splitAt(max))
      pipe(this.ref, tRef.unsafeSet<Array<A> | undefined>(Array.from(remaining), runtime.journal))
      return core.succeed(toTake)
    }).traced(trace)
  }
}

/** @internal */
export const isTQueue = (u: unknown): u is TQueue.TQueue<unknown> => {
  return isTEnqueue(u) && isTDequeue(u)
}

/** @internal */
export const isTEnqueue = (u: unknown): u is TQueue.TEnqueue<unknown> => {
  return typeof u === "object" && u != null && TEnqueueTypeId in u
}

/** @internal */
export const isTDequeue = (u: unknown): u is TQueue.TDequeue<unknown> => {
  return typeof u === "object" && u != null && TDequeueTypeId in u
}

/**
 * @macro traced
 * @internal
 */
export const awaitShutdown = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return self.awaitShutdown().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const bounded = <A>(requestedCapacity: number): STM.STM<never, never, TQueue.TQueue<A>> => {
  const trace = getCallTrace()
  return makeQueue<A>(requestedCapacity, BackPressure).traced(trace)
}

/** @internal */
export const capacity = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): number => {
  return self.capacity()
}

/**
 * @macro traced
 * @internal
 */
export const dropping = <A>(requestedCapacity: number): STM.STM<never, never, TQueue.TQueue<A>> => {
  const trace = getCallTrace()
  return makeQueue<A>(requestedCapacity, Dropping).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isEmpty = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return self.isEmpty().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isFull = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return self.isFull().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isShutdown = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return self.isShutdown().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const offer = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: TQueue.TEnqueue<A>): STM.STM<never, never, void> => self.offer(value).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const offerAll = <A>(iterable: Iterable<A>) => {
  const trace = getCallTrace()
  return (self: TQueue.TEnqueue<A>): STM.STM<never, never, boolean> => self.offerAll(iterable).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const peek = <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  return self.peek().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const peekOption = <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return self.peekOption().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const poll = <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Option.Option<A>> => {
  const trace = getCallTrace()
  return pipe(self.takeUpTo(1), core.map(Chunk.head)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const seek = <A>(predicate: Predicate<A>) => {
  const trace = getCallTrace()
  return (self: TQueue.TDequeue<A>): STM.STM<never, never, A> =>
    pipe(
      self.take(),
      core.flatMap((a) => predicate(a) ? core.succeed(a) : pipe(self, seek(predicate)))
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const shutdown = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return self.shutdown().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const size = <A>(self: TQueue.TDequeue<A> | TQueue.TEnqueue<A>): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return self.size().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const sliding = <A>(requestedCapacity: number): STM.STM<never, never, TQueue.TQueue<A>> => {
  const trace = getCallTrace()
  return makeQueue<A>(requestedCapacity, Sliding).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const take = <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, A> => {
  const trace = getCallTrace()
  return self.take().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeAll = <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return self.takeAll().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeBetween = (min: number, max: number) => {
  const trace = getCallTrace()
  return <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Chunk.Chunk<A>> =>
    stm.suspend(() => {
      /** @macro traced */
      const takeRemainder = (min: number, max: number, acc: Chunk.Chunk<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
        const trace = getCallTrace()
        if (max < min) {
          return core.succeed(acc).traced(trace)
        }
        return pipe(
          self.takeUpTo(max),
          core.flatMap((taken) => {
            const remaining = min - taken.length
            if (remaining === 1) {
              return pipe(
                self.take(),
                core.map((a) => pipe(acc, Chunk.concat(taken), Chunk.append(a)))
              )
            }
            if (remaining > 1) {
              return pipe(
                self.take(),
                core.flatMap((a) =>
                  takeRemainder(
                    remaining - 1,
                    max - taken.length - 1,
                    pipe(acc, Chunk.concat(taken), Chunk.append(a))
                  )
                )
              )
            }
            return core.succeed(pipe(acc, Chunk.concat(taken)))
          })
        ).traced(trace)
      }
      return takeRemainder(min, max, Chunk.empty<A>())
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeN = (n: number) => {
  const trace = getCallTrace()
  return <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Chunk.Chunk<A>> =>
    pipe(self, takeBetween(n, n)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const takeUpTo = (max: number) => {
  return <A>(self: TQueue.TDequeue<A>): STM.STM<never, never, Chunk.Chunk<A>> => {
    const trace = getCallTrace()
    return self.takeUpTo(max).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
export const unbounded = <A>(): STM.STM<never, never, TQueue.TQueue<A>> => {
  const trace = getCallTrace()
  return makeQueue<A>(Number.MAX_SAFE_INTEGER, Dropping).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
const makeQueue = <A>(requestedCapacity: number, strategy: TQueueStrategy): STM.STM<never, never, TQueue.TQueue<A>> => {
  const trace = getCallTrace()
  return pipe(
    tRef.make<Array<A>>([]),
    core.map((ref) => new TQueueImpl(ref, requestedCapacity, strategy))
  ).traced(trace)
}
