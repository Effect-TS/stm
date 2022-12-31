import { getCallTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as FiberId from "@effect/io/Fiber/Id"
import type * as Scope from "@effect/io/src/Scope"
import * as core from "@effect/stm/internal/core"
import * as tRef from "@effect/stm/internal/tRef"
import type * as STM from "@effect/stm/STM"
import type * as TReentrantLock from "@effect/stm/TReentrantLock"
import type * as TRef from "@effect/stm/TRef"
import * as Equal from "@fp-ts/data/Equal"
import { pipe } from "@fp-ts/data/Function"
import * as HashMap from "@fp-ts/data/HashMap"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const TReentrantLockSymbolKey = "@effect/stm/TReentrantLock"

/** @internal */
export const TReentrantLockTypeId: TReentrantLock.TReentrantLockTypeId = Symbol.for(
  TReentrantLockSymbolKey
) as TReentrantLock.TReentrantLockTypeId

/** @internal */
const WriteLockTypeId = Symbol.for("@effect/stm/TReentrantLock/WriteLock")

/** @internal */
type WriteLockTypeId = typeof WriteLockTypeId

/** @internal */
const ReadLockTypeId = Symbol.for("@effect/stm/TReentrantLock/ReadLock")

/** @internal */
type ReadLockTypeId = typeof ReadLockTypeId

/** @internal */
class TReentranLockImpl implements TReentrantLock.TReentrantLock {
  readonly [TReentrantLockTypeId]: TReentrantLock.TReentrantLockTypeId = TReentrantLockTypeId
  constructor(readonly state: TRef.TRef<LockState>) {}
}

/** @internal */
export interface LockState {
  /**
   * Computes the total number of read locks acquired.
   */
  readonly readLocks: number
  /**
   * Computes the total number of write locks acquired.
   */
  readonly writeLocks: number
  /**
   * Computes the number of read locks held by the specified fiber id.
   */
  readLocksHeld(fiberId: FiberId.FiberId): number
  /**
   * Computes the number of write locks held by the specified fiber id.
   */
  writeLocksHeld(fiberId: FiberId.FiberId): number
}

/**
 * This data structure describes the state of the lock when multiple fibers
 * have acquired read locks. The state is tracked as a map from fiber identity
 * to number of read locks acquired by the fiber. This level of detail permits
 * upgrading a read lock to a write lock.
 *
 * @internal
 */
export class ReadLock implements LockState {
  readonly [ReadLockTypeId]: ReadLockTypeId = ReadLockTypeId
  constructor(readonly readers: HashMap.HashMap<FiberId.FiberId, number>) {}
  get readLocks(): number {
    return Array.from(this.readers).reduce((acc, curr) => acc + curr[1], 0)
  }
  get writeLocks(): number {
    return 0
  }
  readLocksHeld(fiberId: FiberId.FiberId): number {
    return pipe(this.readers, HashMap.get(fiberId), Option.getOrElse(() => 0))
  }
  writeLocksHeld(_fiberId: FiberId.FiberId): number {
    return 0
  }
}

/**
 * This data structure describes the state of the lock when a single fiber has
 * a write lock. The fiber has an identity, and may also have acquired a
 * certain number of read locks.
 *
 * @internal
 */
export class WriteLock implements LockState {
  readonly [WriteLockTypeId]: WriteLockTypeId = WriteLockTypeId
  constructor(
    readonly readLocks: number,
    readonly writeLocks: number,
    readonly fiberId: FiberId.FiberId
  ) {}
  readLocksHeld(fiberId: FiberId.FiberId): number {
    return Equal.equals(fiberId)(this.fiberId) ? this.readLocks : 0
  }
  writeLocksHeld(fiberId: FiberId.FiberId): number {
    return Equal.equals(fiberId)(this.fiberId) ? this.writeLocks : 0
  }
}

/** @internal */
const isReadLock = (lock: LockState): lock is ReadLock => {
  return ReadLockTypeId in lock
}

/** @internal */
const isWriteLock = (lock: LockState): lock is WriteLock => {
  return WriteLockTypeId in lock
}

/**
 * An empty read lock state, in which no fiber holds any read locks.
 *
 * @internal
 */
const emptyReadLock = new ReadLock(HashMap.empty())

/**
 * Creates a new read lock where the specified fiber holds the specified
 * number of read locks.
 *
 * @internal
 */
const makeReadLock = (fiberId: FiberId.FiberId, count: number): ReadLock => {
  if (count <= 0) {
    return emptyReadLock
  }
  return new ReadLock(HashMap.make([fiberId, count]))
}

/**
 * Determines if there is no other holder of read locks aside from the
 * specified fiber id. If there are no other holders of read locks aside
 * from the specified fiber id, then it is safe to upgrade the read lock
 * into a write lock.
 *
 * @internal
 */
const noOtherHolder = (readLock: ReadLock, fiberId: FiberId.FiberId): boolean => {
  return HashMap.isEmpty(readLock.readers) ||
    (HashMap.size(readLock.readers) === 1 && pipe(readLock.readers, HashMap.has(fiberId)))
}

/**
 * Adjusts the number of read locks held by the specified fiber id.
 *
 * @internal
 */
const adjustReadLock = (readLock: ReadLock, fiberId: FiberId.FiberId, adjustment: number): ReadLock => {
  const total = readLock.readLocksHeld(fiberId)
  const newTotal = total + adjustment
  if (newTotal < 0) {
    throw new Error(
      "BUG - TReentrantLock.ReadLock.adjust - please report an issue at https://github.com/Effect-TS/stm/issues"
    )
  }
  if (newTotal === 0) {
    return new ReadLock(pipe(readLock.readers, HashMap.remove(fiberId)))
  }
  return new ReadLock(pipe(readLock.readers, HashMap.set(fiberId, newTotal)))
}

/**
 * @macro traced
 * @internal
 */
const adjustRead = (delta: number) => {
  const trace = getCallTrace()
  return (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> =>
    core.withSTMRuntime((runtime) => {
      const lock = pipe(self.state, tRef.unsafeGet(runtime.journal))
      if (isReadLock(lock)) {
        const result = adjustReadLock(lock, runtime.fiberId, delta)
        pipe(self.state, tRef.unsafeSet<LockState>(result, runtime.journal))
        return core.succeed(result.readLocksHeld(runtime.fiberId))
      }
      if (isWriteLock(lock) && Equal.equals(runtime.fiberId)(lock.fiberId)) {
        const newTotal = lock.readLocks + delta
        if (newTotal < 0) {
          throw new Error(
            `Defect: Fiber ${
              FiberId.threadName(runtime.fiberId)
            } releasing read locks it does not hold, newTotal: ${newTotal}`
          )
        }
        pipe(
          self.state,
          tRef.unsafeSet<LockState>(
            new WriteLock(newTotal, lock.writeLocks, runtime.fiberId),
            runtime.journal
          )
        )
        return core.succeed(newTotal)
      }
      return core.retry()
    }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const acquireRead = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return pipe(self, adjustRead(1)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const acquireWrite = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return core.withSTMRuntime((runtime) => {
    const lock = pipe(self.state, tRef.unsafeGet(runtime.journal))
    if (isReadLock(lock) && noOtherHolder(lock, runtime.fiberId)) {
      pipe(
        self.state,
        tRef.unsafeSet<LockState>(
          new WriteLock(lock.readLocksHeld(runtime.fiberId), 1, runtime.fiberId),
          runtime.journal
        )
      )
      return core.succeed(1)
    }
    if (isWriteLock(lock) && Equal.equals(runtime.fiberId)(lock.fiberId)) {
      pipe(
        self.state,
        tRef.unsafeSet<LockState>(
          new WriteLock(lock.readLocks, lock.writeLocks + 1, runtime.fiberId),
          runtime.journal
        )
      )
      return core.succeed(lock.writeLocks + 1)
    }
    return core.retry()
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fiberReadLocks = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return core.effect<never, number>((journal, fiberId) => {
    return pipe(self.state, tRef.unsafeGet(journal)).readLocksHeld(fiberId)
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fiberWriteLocks = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return core.effect<never, number>((journal, fiberId) => {
    return pipe(self.state, tRef.unsafeGet(journal)).writeLocksHeld(fiberId)
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const lock = (self: TReentrantLock.TReentrantLock): Effect.Effect<Scope.Scope, never, number> => {
  const trace = getCallTrace()
  return writeLock(self).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const locked = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return pipe(
    readLocked(self),
    core.zipWith(writeLocked(self), (x, y) => x || y)
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const make = (): STM.STM<never, never, TReentrantLock.TReentrantLock> => {
  const trace = getCallTrace()
  return pipe(
    tRef.make(emptyReadLock),
    core.map((readLock) => new TReentranLockImpl(readLock))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const readLock = (self: TReentrantLock.TReentrantLock): Effect.Effect<Scope.Scope, never, number> => {
  const trace = getCallTrace()
  return Effect.acquireRelease(
    core.commit(acquireRead(self)),
    () => core.commit(releaseRead(self))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const readLocks = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.state), core.map((state) => state.readLocks)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const readLocked = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.state), core.map((state) => state.readLocks > 0)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const releaseRead = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return pipe(self, adjustRead(-1)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const releaseWrite = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return core.withSTMRuntime((runtime) => {
    const lock = pipe(self.state, tRef.unsafeGet(runtime.journal))
    if (isWriteLock(lock) && lock.writeLocks === 1 && Equal.equals(runtime.fiberId)(lock.fiberId)) {
      const result = makeReadLock(lock.fiberId, lock.readLocks)
      pipe(self.state, tRef.unsafeSet<LockState>(result, runtime.journal))
      return core.succeed(result.writeLocksHeld(runtime.fiberId))
    }
    if (isWriteLock(lock) && Equal.equals(runtime.fiberId)(lock.fiberId)) {
      const result = new WriteLock(lock.readLocks, lock.writeLocks - 1, runtime.fiberId)
      pipe(self.state, tRef.unsafeSet<LockState>(result, runtime.journal))
      return core.succeed(result.writeLocksHeld(runtime.fiberId))
    }
    throw new Error(
      `Defect: Fiber ${FiberId.threadName(runtime.fiberId)} releasing write lock it does not hold`
    )
  }).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const withLock = <R, E, A>(effect: Effect.Effect<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TReentrantLock.TReentrantLock): Effect.Effect<R, E, A> =>
    pipe(self, withWriteLock(effect)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const withReadLock = <R, E, A>(effect: Effect.Effect<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TReentrantLock.TReentrantLock): Effect.Effect<R, E, A> =>
    Effect.uninterruptibleMask((restore) =>
      pipe(
        restore(core.commit(acquireRead(self))),
        Effect.zipRight(pipe(restore(effect), Effect.ensuring(core.commit(releaseRead(self)))))
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const withWriteLock = <R, E, A>(effect: Effect.Effect<R, E, A>) => {
  const trace = getCallTrace()
  return (self: TReentrantLock.TReentrantLock): Effect.Effect<R, E, A> =>
    Effect.uninterruptibleMask((restore) =>
      pipe(
        restore(core.commit(acquireWrite(self))),
        Effect.zipRight(pipe(restore(effect), Effect.ensuring(core.commit(releaseWrite(self)))))
      )
    ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const writeLock = (self: TReentrantLock.TReentrantLock): Effect.Effect<Scope.Scope, never, number> => {
  const trace = getCallTrace()
  return Effect.acquireRelease(
    core.commit(acquireWrite(self)),
    () => core.commit(releaseWrite(self))
  ).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const writeLocked = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, boolean> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.state), core.map((state) => state.writeLocks > 0)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const writeLocks = (self: TReentrantLock.TReentrantLock): STM.STM<never, never, number> => {
  const trace = getCallTrace()
  return pipe(tRef.get(self.state), core.map((state) => state.writeLocks)).traced(trace)
}
