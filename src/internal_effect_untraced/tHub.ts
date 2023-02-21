import * as Chunk from "@effect/data/Chunk"
import * as HashSet from "@effect/data/HashSet"
import * as Debug from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import type * as Scope from "@effect/io/Scope"
import * as core from "@effect/stm/internal_effect_untraced/core"
import * as OpCodes from "@effect/stm/internal_effect_untraced/opCodes/strategy"
import * as stm from "@effect/stm/internal_effect_untraced/stm"
import * as tQueue from "@effect/stm/internal_effect_untraced/tQueue"
import * as tRef from "@effect/stm/internal_effect_untraced/tRef"
import type * as STM from "@effect/stm/STM"
import type * as THub from "@effect/stm/THub"
import type * as TQueue from "@effect/stm/TQueue"
import type * as TRef from "@effect/stm/TRef"
import { identity, pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"

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

  awaitShutdown(): STM.STM<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.flatMap(
        this.isShutdown(),
        (isShutdown) => isShutdown ? stm.unit() : core.retry()
      ).traced(trace)
    )
  }

  capacity(): number {
    return this.requestedCapacity
  }

  isEmpty(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.map(this.size(), (size) => size === 0).traced(trace))
  }

  isFull(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.map(this.size(), (size) => size === this.capacity()).traced(trace))
  }

  isShutdown(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.effect<never, boolean>((journal) => {
        const currentPublisherTail = tRef.unsafeGet(this.publisherTail, journal)
        return currentPublisherTail === undefined
      }).traced(trace)
    )
  }

  offer(value: A): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const currentPublisherTail = tRef.unsafeGet(this.publisherTail, runtime.journal)
        if (currentPublisherTail === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        const currentSubscriberCount = tRef.unsafeGet(this.subscriberCount, runtime.journal)
        if (currentSubscriberCount === 0) {
          return core.succeed(true)
        }
        const currentHubSize = tRef.unsafeGet(this.hubSize, runtime.journal)
        if (currentHubSize < this.requestedCapacity) {
          const updatedPublisherTail: TRef.TRef<Node<A> | undefined> = new tRef.TRefImpl(void 0)
          const updatedNode = makeNode(value, currentSubscriberCount, updatedPublisherTail)
          tRef.unsafeSet<Node<A> | undefined>(currentPublisherTail, updatedNode, runtime.journal)
          tRef.unsafeSet<TRef.TRef<Node<A> | undefined> | undefined>(
            this.publisherTail,
            updatedPublisherTail,
            runtime.journal
          )
          tRef.unsafeSet(this.hubSize, currentHubSize + 1, runtime.journal)
          return core.succeed(true)
        }
        switch (this.strategy._tag) {
          case OpCodes.OP_BACKPRESSURE_STRATEGY: {
            return core.retry()
          }
          case OpCodes.OP_DROPPING_STRATEGY: {
            return core.succeed(false)
          }
          case OpCodes.OP_SLIDING_STRATEGY: {
            if (this.requestedCapacity > 0) {
              let currentPublisherHead: TRef.TRef<Node<A> | undefined> = tRef.unsafeGet(
                this.publisherHead,
                runtime.journal
              )
              let loop = true
              while (loop) {
                const node = tRef.unsafeGet(currentPublisherHead, runtime.journal)
                if (node === undefined) {
                  return core.retry()
                }
                const head = node.head
                const tail = node.tail
                if (head !== undefined) {
                  const updatedNode = makeNode(void 0, node.subscribers, node.tail)
                  tRef.unsafeSet<Node<A | undefined> | undefined>(currentPublisherHead, updatedNode, runtime.journal)
                  tRef.unsafeSet(this.publisherHead, tail, runtime.journal)
                  loop = false
                } else {
                  currentPublisherHead = tail
                }
              }
            }
            const updatedPublisherTail: TRef.TRef<Node<A> | undefined> = new tRef.TRefImpl(void 0)
            const updatedNode = makeNode(value, currentSubscriberCount, updatedPublisherTail)
            tRef.unsafeSet<Node<A> | undefined>(currentPublisherTail, updatedNode, runtime.journal)
            tRef.unsafeSet<TRef.TRef<Node<A> | undefined> | undefined>(
              this.publisherTail,
              updatedPublisherTail,
              runtime.journal
            )
            return core.succeed(true)
          }
        }
      }).traced(trace)
    )
  }

  offerAll(iterable: Iterable<A>): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.map(
        stm.forEach(iterable, (a) => this.offer(a)),
        Chunk.every(identity)
      ).traced(trace)
    )
  }

  size(): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        const currentPublisherTail = tRef.unsafeGet(this.publisherTail, runtime.journal)
        if (currentPublisherTail === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        return core.succeed(tRef.unsafeGet(this.hubSize, runtime.journal))
      }).traced(trace)
    )
  }

  shutdown(): STM.STM<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.effect<never, void>((journal) => {
        const currentPublisherTail = tRef.unsafeGet(this.publisherTail, journal)
        if (currentPublisherTail !== undefined) {
          tRef.unsafeSet<TRef.TRef<Node<A> | undefined> | undefined>(this.publisherTail, void 0, journal)
          const currentSubscribers = tRef.unsafeGet(this.subscribers, journal)
          HashSet.forEach(currentSubscribers, (subscriber) => {
            tRef.unsafeSet<TRef.TRef<Node<A>> | undefined>(subscriber, void 0, journal)
          })
          tRef.unsafeSet(this.subscribers, HashSet.empty<TRef.TRef<TRef.TRef<Node<A>> | undefined>>(), journal)
        }
      }).traced(trace)
    )
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

  awaitShutdown(): STM.STM<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.flatMap(
        this.isShutdown(),
        (isShutdown) => isShutdown ? stm.unit() : core.retry()
      ).traced(trace)
    )
  }

  capacity(): number {
    return this.requestedCapacity
  }

  isEmpty(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.map(this.size(), (size) => size === 0).traced(trace))
  }

  isFull(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.map(this.size(), (size) => size === this.capacity()).traced(trace))
  }

  isShutdown(): STM.STM<never, never, boolean> {
    return Debug.bodyWithTrace((trace) =>
      core.effect<never, boolean>((journal) => {
        const currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, journal)
        return currentSubscriberHead === undefined
      }).traced(trace)
    )
  }

  peek(): STM.STM<never, never, A> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        let currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, runtime.journal)
        if (currentSubscriberHead === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        let value: A | undefined = undefined
        let loop = true
        while (loop) {
          const node = tRef.unsafeGet(currentSubscriberHead, runtime.journal)
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
    )
  }

  peekOption(): STM.STM<never, never, Option.Option<A>> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        let currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, runtime.journal)
        if (currentSubscriberHead === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        let value: Option.Option<A> = Option.none()
        let loop = true
        while (loop) {
          const node = tRef.unsafeGet(currentSubscriberHead, runtime.journal)
          if (node === undefined) {
            value = Option.none()
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
    )
  }

  size(): STM.STM<never, never, number> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        let currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, runtime.journal)
        if (currentSubscriberHead === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        let loop = true
        let size = 0
        while (loop) {
          const node = tRef.unsafeGet(currentSubscriberHead, runtime.journal)
          if (node === undefined) {
            loop = false
          } else {
            const head = node.head
            const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
            if (head !== undefined) {
              size = size + 1
              if (size >= Number.MAX_SAFE_INTEGER) {
                loop = false
              }
            }
            currentSubscriberHead = tail
          }
        }
        return core.succeed(size)
      }).traced(trace)
    )
  }

  shutdown(): STM.STM<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.effect<never, void>((journal) => {
        let currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, journal)
        if (currentSubscriberHead !== undefined) {
          tRef.unsafeSet<TRef.TRef<Node<A | undefined> | undefined> | undefined>(this.subscriberHead, void 0, journal)
          let loop = true
          while (loop) {
            const node = tRef.unsafeGet(currentSubscriberHead, journal)
            if (node === undefined) {
              loop = false
            } else {
              const head = node.head
              const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
              if (head !== undefined) {
                const subscribers = node.subscribers
                if (subscribers === 1) {
                  const size = tRef.unsafeGet(this.hubSize, journal)
                  const updatedNode = makeNode(undefined, 0, tail)
                  tRef.unsafeSet<Node<A | undefined> | undefined>(currentSubscriberHead, updatedNode, journal)
                  tRef.unsafeSet(this.publisherHead, tail, journal)
                  tRef.unsafeSet(this.hubSize, size - 1, journal)
                } else {
                  const updatedNode = makeNode(head, subscribers - 1, tail)
                  tRef.unsafeSet<Node<A | undefined> | undefined>(currentSubscriberHead, updatedNode, journal)
                }
              }
              currentSubscriberHead = tail
            }
          }
          const currentSubscriberCount = tRef.unsafeGet(this.subscriberCount, journal)
          tRef.unsafeSet(this.subscriberCount, currentSubscriberCount - 1, journal)
          tRef.unsafeSet(
            this.subscribers,
            HashSet.remove(
              tRef.unsafeGet(this.subscribers, journal),
              this.subscriberHead
            ),
            journal
          )
        }
      }).traced(trace)
    )
  }

  take(): STM.STM<never, never, A> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        let currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, runtime.journal)
        if (currentSubscriberHead === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        let value: A | undefined = undefined
        let loop = true
        while (loop) {
          const node = tRef.unsafeGet(currentSubscriberHead, runtime.journal)
          if (node === undefined) {
            return core.retry()
          }
          const head = node.head
          const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
          if (head !== undefined) {
            const subscribers = node.subscribers
            if (subscribers === 1) {
              const size = tRef.unsafeGet(this.hubSize, runtime.journal)
              const updatedNode = makeNode(void 0, 0, tail)
              tRef.unsafeSet<Node<A | undefined> | undefined>(currentSubscriberHead, updatedNode, runtime.journal)
              tRef.unsafeSet(this.publisherHead, tail, runtime.journal)
              tRef.unsafeSet(this.hubSize, size - 1, runtime.journal)
            } else {
              const updatedNode = makeNode(head, subscribers - 1, tail)
              tRef.unsafeSet<Node<A | undefined> | undefined>(currentSubscriberHead, updatedNode, runtime.journal)
            }
            tRef.unsafeSet<TRef.TRef<Node<A | undefined> | undefined> | undefined>(
              this.subscriberHead,
              tail,
              runtime.journal
            )
            value = head
            loop = false
          } else {
            currentSubscriberHead = tail
          }
        }
        return core.succeed(value!)
      }).traced(trace)
    )
  }

  takeAll(): STM.STM<never, never, Chunk.Chunk<A>> {
    return Debug.bodyWithTrace((trace) => this.takeUpTo(Number.POSITIVE_INFINITY).traced(trace))
  }

  takeUpTo(max: number): STM.STM<never, never, Chunk.Chunk<A>> {
    return Debug.bodyWithTrace((trace) =>
      core.withSTMRuntime((runtime) => {
        let currentSubscriberHead = tRef.unsafeGet(this.subscriberHead, runtime.journal)
        if (currentSubscriberHead === undefined) {
          return core.interruptAs(runtime.fiberId)
        }
        const builder: Array<A> = []
        let n = 0
        while (n !== max) {
          const node = tRef.unsafeGet(currentSubscriberHead, runtime.journal)
          if (node === undefined) {
            n = max
          } else {
            const head = node.head
            const tail: TRef.TRef<Node<A | undefined> | undefined> = node.tail
            if (head !== undefined) {
              const subscribers = node.subscribers
              if (subscribers === 1) {
                const size = tRef.unsafeGet(this.hubSize, runtime.journal)
                const updatedNode = makeNode(void 0, 0, tail)
                tRef.unsafeSet<Node<A | undefined> | undefined>(currentSubscriberHead, updatedNode, runtime.journal)
                tRef.unsafeSet(this.publisherHead, tail, runtime.journal)
                tRef.unsafeSet(this.hubSize, size - 1, runtime.journal)
              } else {
                const updatedNode = makeNode(head, subscribers - 1, tail)
                tRef.unsafeSet<Node<A | undefined> | undefined>(currentSubscriberHead, updatedNode, runtime.journal)
              }
              builder.push(head)
              n = n + 1
            }
            currentSubscriberHead = tail
          }
        }
        tRef.unsafeSet<TRef.TRef<Node<A | undefined> | undefined> | undefined>(
          this.subscriberHead,
          currentSubscriberHead,
          runtime.journal
        )
        return core.succeed(Chunk.unsafeFromArray(builder))
      }).traced(trace)
    )
  }
}

/** @internal */
const makeHub = Debug.methodWithTrace((trace) =>
  <A>(
    requestedCapacity: number,
    strategy: tQueue.TQueueStrategy
  ): STM.STM<never, never, THub.THub<A>> =>
    pipe(
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
)

const makeSubscription = <A>(
  hubSize: TRef.TRef<number>,
  publisherHead: TRef.TRef<TRef.TRef<Node<A> | undefined>>,
  publisherTail: TRef.TRef<TRef.TRef<Node<A> | undefined> | undefined>,
  requestedCapacity: number,
  subscriberCount: TRef.TRef<number>,
  subscribers: TRef.TRef<HashSet.HashSet<TRef.TRef<TRef.TRef<Node<A>> | undefined>>>
): STM.STM<never, never, TQueue.TDequeue<A>> =>
  pipe(
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
  )

/** @internal */
export const awaitShutdown = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, void> => self.awaitShutdown().traced(trace)
)

/** @internal */
export const bounded = Debug.methodWithTrace((trace) =>
  <A>(requestedCapacity: number): STM.STM<never, never, THub.THub<A>> =>
    makeHub<A>(requestedCapacity, tQueue.BackPressure).traced(trace)
)

/** @internal */
export const capacity = <A>(self: THub.THub<A>): number => self.capacity()

/** @internal */
export const dropping = Debug.methodWithTrace((trace) =>
  <A>(requestedCapacity: number): STM.STM<never, never, THub.THub<A>> =>
    makeHub<A>(requestedCapacity, tQueue.Dropping).traced(trace)
)

/** @internal */
export const isEmpty = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, boolean> => self.isEmpty().traced(trace)
)

/** @internal */
export const isFull = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, boolean> => self.isFull().traced(trace)
)

/** @internal */
export const isShutdown = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, boolean> => self.isShutdown().traced(trace)
)

/** @internal */
export const publish = Debug.dualWithTrace<
  <A>(value: A) => (self: THub.THub<A>) => STM.STM<never, never, boolean>,
  <A>(self: THub.THub<A>, value: A) => STM.STM<never, never, boolean>
>(2, (trace) => (self, value) => self.offer(value).traced(trace))

/** @internal */
export const publishAll = Debug.dualWithTrace<
  <A>(iterable: Iterable<A>) => (self: THub.THub<A>) => STM.STM<never, never, boolean>,
  <A>(self: THub.THub<A>, iterable: Iterable<A>) => STM.STM<never, never, boolean>
>(2, (trace) => (self, iterable) => self.offerAll(iterable).traced(trace))

/** @internal */
export const size = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, number> => self.size().traced(trace)
)

/** @internal */
export const shutdown = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, void> => self.shutdown().traced(trace)
)

/** @internal */
export const sliding = Debug.methodWithTrace((trace) =>
  <A>(requestedCapacity: number): STM.STM<never, never, THub.THub<A>> =>
    makeHub<A>(requestedCapacity, tQueue.Sliding).traced(trace)
)

/** @internal */
export const subscribe = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): STM.STM<never, never, TQueue.TDequeue<A>> =>
    makeSubscription(
      self.hubSize,
      self.publisherHead,
      self.publisherTail,
      self.requestedCapacity,
      self.subscriberCount,
      self.subscribers
    ).traced(trace)
)

/** @internal */
export const subscribeScoped = Debug.methodWithTrace((trace) =>
  <A>(self: THub.THub<A>): Effect.Effect<Scope.Scope, never, TQueue.TDequeue<A>> =>
    Effect.acquireRelease(subscribe(self), (dequeue) => tQueue.shutdown(dequeue)).traced(trace)
)

/** @internal */
export const unbounded = Debug.methodWithTrace((trace) =>
  <A>(): STM.STM<never, never, THub.THub<A>> => makeHub<A>(Number.MAX_SAFE_INTEGER, tQueue.Dropping).traced(trace)
)
