import { getCallTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import type * as Scope from "@effect/io/Scope"
import * as core from "@effect/stm/internal/core"
import * as OpCodes from "@effect/stm/internal/opCodes/strategy"
import * as stm from "@effect/stm/internal/stm"
import * as tQueue from "@effect/stm/internal/tQueue"
import * as tRef from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"
import type * as THub from "@effect/stm/THub"
import type * as TQueue from "@effect/stm/TQueue"
import type * as TRef from "@effect/stm/TRef"
import * as Chunk from "@fp-ts/data/Chunk"
import { identity, pipe } from "@fp-ts/data/Function"
import * as HashSet from "@fp-ts/data/HashSet"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const THubSymbolKey = "@effect/stm/THub"

/** @internal */
export const THubTypeId: THub.THubTypeId = Symbol.for(THubSymbolKey) as THub.THubTypeId

/** @internal */
export interface Node<A> {
  readonly head: A
  readonly subscribers: number
  readonly tail: TRef.TRef<Node<A> | undefined>
}

/** @internal */
export const makeNode = <A>(
  head: A,
  subscribers: number,
  tail: TRef.TRef<Node<A> | undefined>
): Node<A> => ({
  head,
  subscribers,
  tail
})

/** @internal */
class THubImpl<A> implements THub.THub<A> {
  readonly [THubTypeId]: THub.THubTypeId = THubTypeId
  readonly [tQueue.TEnqueueTypeId] = tQueue.tEnqueueVariance
  constructor(
    readonly hubSize: TRef.TRef<number>,
    readonly publisherHead: TRef.TRef<TRef.TRef<Node<A> | undefined>>,
    readonly publisherTail: TRef.TRef<TRef.TRef<Node<A> | undefined> | undefined>,
    readonly requestedCapacity: number,
    readonly strategy: tQueue.TQueueStrategy,
    readonly subscriberCount: TRef.TRef<number>,
    readonly subscribers: TRef.TRef<HashSet.HashSet<TRef.TRef<TRef.TRef<Node<A>> | undefined>>>
  ) {}

  /**
   * @macro traced
   */
  awaitShutdown(): STM.STM<never, never, void> {
    const trace = getCallTrace()
    return pipe(
      this.isShutdown(),
      core.flatMap((isShutdown) => isShutdown ? stm.unit() : core.retry())
    ).traced(trace)
  }

  capacity(): number {
    return this.requestedCapacity
  }

  /**
   * @macro traced
   */
  isEmpty(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(
      this.size(),
      core.map((size) => size === 0)
    ).traced(trace)
  }

  /**
   * @macro traced
   */
  isFull(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(
      this.size(),
      core.map((size) => size === this.capacity())
    ).traced(trace)
  }

  /**
   * @macro traced
   */
  isShutdown(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return core.effect<never, boolean>((journal) => {
      const currentPublisherTail = pipe(this.publisherTail, tRef.unsafeGet(journal))
      return currentPublisherTail === undefined
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  offer(value: A): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const currentPublisherTail = pipe(this.publisherTail, tRef.unsafeGet(runtime.journal))
      if (currentPublisherTail === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      const currentSubscriberCount = pipe(this.subscriberCount, tRef.unsafeGet(runtime.journal))
      if (currentSubscriberCount === 0) {
        return core.succeed(true)
      }
      const currentHubSize = pipe(this.hubSize, tRef.unsafeGet(runtime.journal))
      if (currentHubSize < this.requestedCapacity) {
        const updatedPublisherTail: TRef.TRef<Node<A> | undefined> = new tRef.TRefImpl(void 0)
        const updatedNode = makeNode(value, currentSubscriberCount, updatedPublisherTail)
        pipe(currentPublisherTail, tRef.unsafeSet<Node<A> | undefined>(updatedNode, runtime.journal))
        pipe(
          this.publisherTail,
          tRef.unsafeSet<TRef.TRef<Node<A> | undefined> | undefined>(updatedPublisherTail, runtime.journal)
        )
        pipe(this.hubSize, tRef.unsafeSet(currentHubSize + 1, runtime.journal))
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
          if (this.requestedCapacity > 0) {
            let currentPublisherHead: TRef.TRef<Node<A> | undefined> = pipe(
              this.publisherHead,
              tRef.unsafeGet(runtime.journal)
            )
            let loop = true
            while (loop) {
              const node = pipe(currentPublisherHead, tRef.unsafeGet(runtime.journal))
              if (node === undefined) {
                return core.retry()
              }
              const head = node.head
              const tail = node.tail
              if (head !== undefined) {
                const updatedNode = makeNode(void 0, node.subscribers, node.tail)
                pipe(
                  currentPublisherHead,
                  tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, runtime.journal)
                )
                pipe(this.publisherHead, tRef.unsafeSet(tail, runtime.journal))
                loop = false
              } else {
                currentPublisherHead = tail
              }
            }
          }
          const updatedPublisherTail: TRef.TRef<Node<A> | undefined> = new tRef.TRefImpl(void 0)
          const updatedNode = makeNode(value, currentSubscriberCount, updatedPublisherTail)
          pipe(currentPublisherTail, tRef.unsafeSet<Node<A> | undefined>(updatedNode, runtime.journal))
          pipe(
            this.publisherTail,
            tRef.unsafeSet<TRef.TRef<Node<A> | undefined> | undefined>(updatedPublisherTail, runtime.journal)
          )
          return core.succeed(true)
        }
      }
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  offerAll(iterable: Iterable<A>): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(
      iterable,
      stm.forEach((a) => this.offer(a)),
      core.map(Chunk.every(identity))
    ).traced(trace)
  }

  /**
   * @macro traced
   */
  size(): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      const currentPublisherTail = pipe(this.publisherTail, tRef.unsafeGet(runtime.journal))
      if (currentPublisherTail === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      return core.succeed(pipe(this.hubSize, tRef.unsafeGet(runtime.journal)))
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  shutdown(): STM.STM<never, never, void> {
    const trace = getCallTrace()
    return core.effect<never, void>((journal) => {
      const currentPublisherTail = pipe(this.publisherTail, tRef.unsafeGet(journal))
      if (currentPublisherTail !== undefined) {
        pipe(this.publisherTail, tRef.unsafeSet<TRef.TRef<Node<A> | undefined> | undefined>(void 0, journal))
        const currentSubscribers = pipe(this.subscribers, tRef.unsafeGet(journal))
        pipe(
          currentSubscribers,
          HashSet.forEach((subscriber) => {
            pipe(subscriber, tRef.unsafeSet<TRef.TRef<Node<A>> | undefined>(void 0, journal))
          })
        )
        pipe(
          this.subscribers,
          tRef.unsafeSet(HashSet.empty<TRef.TRef<TRef.TRef<Node<A>> | undefined>>(), journal)
        )
      }
    }).traced(trace)
  }
}

/** @internal */
class THubSubscriptionImpl<A> implements TQueue.TDequeue<A> {
  readonly [THubTypeId]: THub.THubTypeId = THubTypeId
  readonly [tQueue.TDequeueTypeId] = tQueue.tDequeueVariance
  constructor(
    readonly hubSize: TRef.TRef<number>,
    readonly publisherHead: TRef.TRef<TRef.TRef<Node<A> | undefined>>,
    readonly requestedCapacity: number,
    readonly subscriberHead: TRef.TRef<TRef.TRef<Node<A | undefined> | undefined> | undefined>,
    readonly subscriberCount: TRef.TRef<number>,
    readonly subscribers: TRef.TRef<HashSet.HashSet<TRef.TRef<TRef.TRef<Node<A>> | undefined>>>
  ) {}

  /**
   * @macro traced
   */
  awaitShutdown(): STM.STM<never, never, void> {
    const trace = getCallTrace()
    return pipe(
      this.isShutdown(),
      core.flatMap((isShutdown) => isShutdown ? stm.unit() : core.retry())
    ).traced(trace)
  }

  capacity(): number {
    return this.requestedCapacity
  }

  /**
   * @macro traced
   */
  isEmpty(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(
      this.size(),
      core.map((size) => size === 0)
    ).traced(trace)
  }

  /**
   * @macro traced
   */
  isFull(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return pipe(
      this.size(),
      core.map((size) => size === this.capacity())
    ).traced(trace)
  }

  /**
   * @macro traced
   */
  isShutdown(): STM.STM<never, never, boolean> {
    const trace = getCallTrace()
    return core.effect<never, boolean>((journal) => {
      const currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(journal))
      return currentSubscriberHead === undefined
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  peek(): STM.STM<never, never, A> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      let currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(runtime.journal))
      if (currentSubscriberHead === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      let value: A | undefined = undefined
      let loop = true
      while (loop) {
        const node = pipe(currentSubscriberHead, tRef.unsafeGet(runtime.journal))
        if (node === undefined) {
          return core.retry()
        }
        const head = node.head
        const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
        if (head !== undefined) {
          value = head
          loop = false
        } else {
          currentSubscriberHead = tail
        }
      }
      return core.succeed(value!)
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  peekOption(): STM.STM<never, never, Option.Option<A>> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      let currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(runtime.journal))
      if (currentSubscriberHead === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      let value: Option.Option<A> = Option.none
      let loop = true
      while (loop) {
        const node = pipe(currentSubscriberHead, tRef.unsafeGet(runtime.journal))
        if (node === undefined) {
          value = Option.none
          loop = false
        } else {
          const head = node.head
          const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
          if (head !== undefined) {
            value = Option.some(head)
            loop = false
          } else {
            currentSubscriberHead = tail
          }
        }
      }
      return core.succeed(value)
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  size(): STM.STM<never, never, number> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      let currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(runtime.journal))
      if (currentSubscriberHead === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      let loop = true
      let size = 0
      while (loop) {
        const node = pipe(currentSubscriberHead, tRef.unsafeGet(runtime.journal))
        if (node === undefined) {
          loop = false
        } else {
          const head = node.head
          const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
          if (head !== undefined) {
            size = size + 1
            if (size === Number.MAX_SAFE_INTEGER) {
              loop = false
            }
          }
          currentSubscriberHead = tail
        }
      }
      return core.succeed(size)
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  shutdown(): STM.STM<never, never, void> {
    const trace = getCallTrace()
    return core.effect<never, void>((journal) => {
      let currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(journal))
      if (currentSubscriberHead !== undefined) {
        pipe(
          this.subscriberHead,
          tRef.unsafeSet<TRef.TRef<Node<A | undefined> | undefined> | undefined>(void 0, journal)
        )
        let loop = true
        while (loop) {
          const node = pipe(currentSubscriberHead, tRef.unsafeGet(journal))
          if (node === undefined) {
            loop = false
          } else {
            const head = node.head
            const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
            if (head !== undefined) {
              const subscribers = node.subscribers
              if (subscribers === 1) {
                const size = pipe(this.hubSize, tRef.unsafeGet(journal))
                const updatedNode = makeNode(undefined, 0, tail)
                pipe(currentSubscriberHead, tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, journal))
                pipe(this.publisherHead, tRef.unsafeSet(tail, journal))
                pipe(this.hubSize, tRef.unsafeSet(size - 1, journal))
              } else {
                const updatedNode = makeNode(head, subscribers - 1, tail)
                pipe(currentSubscriberHead, tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, journal))
              }
            }
            currentSubscriberHead = tail
          }
        }
        const currentSubscriberCount = pipe(this.subscriberCount, tRef.unsafeGet(journal))
        pipe(this.subscriberCount, tRef.unsafeSet(currentSubscriberCount - 1, journal))
        pipe(
          this.subscribers,
          tRef.unsafeSet(
            pipe(
              this.subscribers,
              tRef.unsafeGet(journal),
              HashSet.remove(this.subscriberHead)
            ),
            journal
          )
        )
      }
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  take(): STM.STM<never, never, A> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      let currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(runtime.journal))
      if (currentSubscriberHead === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      let value: A | undefined = undefined
      let loop = true
      while (loop) {
        const node = pipe(currentSubscriberHead, tRef.unsafeGet(runtime.journal))
        if (node === undefined) {
          return core.retry()
        }
        const head = node.head
        const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
        if (head !== undefined) {
          const subscribers = node.subscribers
          if (subscribers === 1) {
            const size = pipe(this.hubSize, tRef.unsafeGet(runtime.journal))
            const updatedNode = makeNode(void 0, 0, tail)
            pipe(
              currentSubscriberHead,
              tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, runtime.journal)
            )
            pipe(this.publisherHead, tRef.unsafeSet(tail, runtime.journal))
            pipe(this.hubSize, tRef.unsafeSet(size - 1, runtime.journal))
          } else {
            const updatedNode = makeNode(head, subscribers - 1, tail)
            pipe(
              currentSubscriberHead,
              tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, runtime.journal)
            )
          }
          pipe(
            this.subscriberHead,
            tRef.unsafeSet<TRef.TRef<Node<A | undefined> | undefined> | undefined>(tail, runtime.journal)
          )
          value = head
          loop = false
        } else {
          currentSubscriberHead = tail
        }
      }
      return core.succeed(value!)
    }).traced(trace)
  }

  /**
   * @macro traced
   */
  takeAll(): STM.STM<never, never, Chunk.Chunk<A>> {
    const trace = getCallTrace()
    return this.takeUpTo(Number.POSITIVE_INFINITY).traced(trace)
  }

  /**
   * @macro traced
   */
  takeUpTo(max: number): STM.STM<never, never, Chunk.Chunk<A>> {
    const trace = getCallTrace()
    return core.withSTMRuntime((runtime) => {
      let currentSubscriberHead = pipe(this.subscriberHead, tRef.unsafeGet(runtime.journal))
      if (currentSubscriberHead === undefined) {
        return core.interruptWith(runtime.fiberId)
      }
      const builder: Array<A> = []
      let n = 0
      while (n !== max) {
        const node = pipe(currentSubscriberHead, tRef.unsafeGet(runtime.journal))
        if (node === undefined) {
          n = max
        } else {
          const head = node.head
          const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
          if (head !== undefined) {
            const subscribers = node.subscribers
            if (subscribers === 1) {
              const size = pipe(this.hubSize, tRef.unsafeGet(runtime.journal))
              const updatedNode = makeNode(void 0, 0, tail)
              pipe(
                currentSubscriberHead,
                tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, runtime.journal)
              )
              pipe(this.publisherHead, tRef.unsafeSet(tail, runtime.journal))
              pipe(this.hubSize, tRef.unsafeSet(size - 1, runtime.journal))
            } else {
              const updatedNode = makeNode(head, subscribers - 1, tail)
              pipe(
                currentSubscriberHead,
                tRef.unsafeSet<Node<A | undefined> | undefined>(updatedNode, runtime.journal)
              )
            }
            builder.push(head)
            n = n + 1
          }
          currentSubscriberHead = tail
        }
      }
      pipe(
        this.subscriberHead,
        tRef.unsafeSet<TRef.TRef<Node<A | undefined> | undefined> | undefined>(currentSubscriberHead, runtime.journal)
      )
      return core.succeed(Chunk.unsafeFromArray(builder))
    }).traced(trace)
  }
}

/**
 * @macro traced
 * @internal
 */
const makeHub = <A>(
  requestedCapacity: number,
  strategy: tQueue.TQueueStrategy
): STM.STM<never, never, THub.THub<A>> => {
  const trace = getCallTrace()
  return pipe(
    stm.tuple(
      tRef.make<Node<A> | undefined>(void 0),
      tRef.make(0)
    ),
    core.flatMap(([empty, hubSize]) =>
      pipe(
        stm.tuple(
          tRef.make(empty),
          tRef.make(empty),
          tRef.make(0),
          tRef.make(HashSet.empty())
        ),
        core.map(([publisherHead, publisherTail, subscriberCount, subscribers]) =>
          new THubImpl(
            hubSize,
            publisherHead,
            publisherTail,
            requestedCapacity,
            strategy,
            subscriberCount,
            subscribers
          )
        )
      )
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
const makeSubscription = <A>(
  hubSize: TRef.TRef<number>,
  publisherHead: TRef.TRef<TRef.TRef<Node<A> | undefined>>,
  publisherTail: TRef.TRef<TRef.TRef<Node<A> | undefined> | undefined>,
  requestedCapacity: number,
  subscriberCount: TRef.TRef<number>,
  subscribers: TRef.TRef<HashSet.HashSet<TRef.TRef<TRef.TRef<Node<A>> | undefined>>>
): STM.STM<never, never, TQueue.TDequeue<A>> => {
  const trace = getCallTrace()
  return pipe(
    tRef.get(publisherTail),
    core.flatMap((currentPublisherTail) =>
      pipe(
        stm.tuple(
          tRef.make(currentPublisherTail),
          tRef.get(subscriberCount),
          tRef.get(subscribers)
        ),
        stm.tap(([_, currentSubscriberCount]) =>
          pipe(
            subscriberCount,
            tRef.set(currentSubscriberCount + 1)
          )
        ),
        stm.tap(([subscriberHead, _, currentSubscribers]) =>
          pipe(
            subscribers,
            tRef.set(pipe(currentSubscribers, HashSet.add(subscriberHead)))
          )
        ),
        core.map(([subscriberHead]) =>
          new THubSubscriptionImpl(
            hubSize,
            publisherHead,
            requestedCapacity,
            subscriberHead,
            subscriberCount,
            subscribers
          )
        )
      )
    )
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const awaitShutdown = <A>(self: THub.THub<A>): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return self.awaitShutdown().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const bounded = <A>(requestedCapacity: number): STM.STM<never, never, THub.THub<A>> => {
  const trace = getCallTrace()
  return makeHub<A>(requestedCapacity, tQueue.BackPressure).traced(trace)
}

/** @internal */
export const capacity = <A>(self: THub.THub<A>): number => {
  return self.capacity()
}

/**
 * @macro traced
 * @internal
 */
export const dropping = <A>(requestedCapacity: number): STM.STM<never, never, THub.THub<A>> => {
  const trace = getCallTrace()
  return makeHub<A>(requestedCapacity, tQueue.Dropping).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isEmpty = <A>(self: THub.THub<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return self.isEmpty().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isFull = <A>(self: THub.THub<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return self.isFull().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const isShutdown = <A>(self: THub.THub<A>): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return self.isShutdown().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const publish = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: THub.THub<A>): STM.STM<never, never, boolean> => self.offer(value).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const publishAll = <A>(iterable: Iterable<A>) => {
  const trace = getCallTrace()
  return (self: THub.THub<A>): STM.STM<never, never, boolean> => self.offerAll(iterable).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const size = <A>(self: THub.THub<A>): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return self.size().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const shutdown = <A>(self: THub.THub<A>): STM.STM<never, never, void> => {
  const trace = getCallTrace()
  return self.shutdown().traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const sliding = <A>(requestedCapacity: number): STM.STM<never, never, THub.THub<A>> => {
  const trace = getCallTrace()
  return makeHub<A>(requestedCapacity, tQueue.Sliding).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const subscribe = <A>(self: THub.THub<A>): STM.STM<never, never, TQueue.TDequeue<A>> => {
  const trace = getCallTrace()
  return makeSubscription(
    self.hubSize,
    self.publisherHead,
    self.publisherTail,
    self.requestedCapacity,
    self.subscriberCount,
    self.subscribers
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const subscribeScoped = <A>(self: THub.THub<A>): Effect.Effect<Scope.Scope, never, TQueue.TDequeue<A>> => {
  const trace = getCallTrace()
  return Effect.acquireRelease(subscribe(self), (dequeue) => tQueue.shutdown(dequeue)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const unbounded = <A>(): STM.STM<never, never, THub.THub<A>> => {
  const trace = getCallTrace()
  return makeHub<A>(Number.MAX_SAFE_INTEGER, tQueue.Dropping).traced(trace)
}
