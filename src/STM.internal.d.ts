import type * as Effect from "@effect/io/Effect"
import type * as circular from "@effect/io/internal/effect/circular"
import type * as stm from "@effect/io/internal/stm"
import type * as ref from "@effect/io/internal/stm/ref"
import type { STM as Local } from "@effect/stm/STM"
import type { TRef } from "@effect/stm/TRef"
import type { TSemaphore } from "@effect/stm/TSemaphore"

/** @internal */
export declare module "@effect/stm/TRef" {
  interface TRef<A> extends ref.Ref<A> {}
}

/** @internal */
export declare module "@effect/stm/STM" {
  /** @internal */
  interface STM<R, E, A> extends stm.STM.Variance<R, E, A> {
    /** @internal */
    trace: string | undefined
    /** @internal */
    traced(trace: string | undefined): STM<R, E, A>
    /** @internal */
    commit(): Effect.Effect<R, E, A>
  }
}

/** @internal */
export declare module "@effect/io/internal/stm" {
  interface STM<R, E, A> extends Local<R, E, A> {}
}

/** @internal */
export declare module "@effect/io/internal/stm/ref" {
  interface Ref<A> extends TRef.Variance<A> {}
  interface RefImpl<A> extends TRef.Variance<A> {}
}

/** @internal */
export declare module "@effect/io/internal/effect/circular" {
  interface Semaphore extends TSemaphore {}
  interface SemaphoreImpl extends TSemaphore {}
}

/** @internal */
export declare module "@effect/stm/TSemaphore" {
  interface TSemaphore {
    readonly [circular.SemaphoreTypeId]: circular.SemaphoreTypeId
    readonly permits: TRef<number>
  }
}
