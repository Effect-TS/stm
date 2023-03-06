import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as STM from "@effect/stm/STM"
import * as it from "@effect/stm/test/utils/extend"
import * as TSet from "@effect/stm/TSet"
import { assert, describe } from "vitest"

describe.concurrent("TSet", () => {
  it.effect("add - new element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.empty<number>(),
        STM.tap(TSet.add(1)),
        STM.flatMap(TSet.toReadonlySet)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, new Set([1]))
    }))

  it.effect("add - duplicate element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1),
        STM.tap(TSet.add(1)),
        STM.flatMap(TSet.toReadonlySet)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, new Set([1]))
    }))

  it.effect("difference", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set1 = yield* $(TSet.make(1, 2, 3))
        const set2 = yield* $(TSet.make(1, 4, 5))
        yield* $(pipe(set1, TSet.difference(set2)))
        return yield* $(TSet.toReadonlyArray(set1))
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [2, 3])
    }))

  it.effect("empty", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.empty<number>(),
        STM.flatMap(TSet.isEmpty)
      )
      const result = yield* $(STM.commit(transaction))
      assert.isTrue(result)
    }))

  it.effect("fromIterable", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.fromIterable([1, 2, 2, 3]),
        STM.flatMap(TSet.toReadonlySet)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, new Set([1, 2, 3]))
    }))

  it.effect("has - existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3, 4),
        STM.flatMap(TSet.has(1))
      )
      const result = yield* $(STM.commit(transaction))
      assert.isTrue(result)
    }))

  it.effect("has - non-existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.empty<number>(),
        STM.flatMap(TSet.has(1))
      )
      const result = yield* $(STM.commit(transaction))
      assert.isFalse(result)
    }))

  it.effect("intersection", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set1 = yield* $(TSet.make(1, 2, 3))
        const set2 = yield* $(TSet.make(1, 4, 5))
        yield* $(pipe(set1, TSet.intersection(set2)))
        return yield* $(TSet.toReadonlyArray(set1))
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [1])
    }))

  it.effect("make", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 2, 3),
        STM.flatMap(TSet.toReadonlySet)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, new Set([1, 2, 3]))
    }))

  it.effect("reduce - non-empty set", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3),
        STM.flatMap(TSet.reduce(0, (x, y) => x + y))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 6)
    }))

  it.effect("reduce - empty set", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.empty<number>(),
        STM.flatMap(TSet.reduce(0, (x, y) => x + y))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 0)
    }))

  it.effect("reduceSTM - non-empty set", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3),
        STM.flatMap(TSet.reduceSTM(0, (x, y) => STM.succeed(x + y)))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 6)
    }))

  it.effect("reduceSTM - empty set", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.empty<number>(),
        STM.flatMap(TSet.reduceSTM(0, (x, y) => STM.succeed(x + y)))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 0)
    }))

  it.effect("remove - existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2),
        STM.tap(TSet.remove(1)),
        STM.flatMap(TSet.toReadonlySet)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, new Set([2]))
    }))

  it.effect("remove - non-existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2),
        STM.tap(TSet.remove(3)),
        STM.flatMap(TSet.toReadonlySet)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, new Set([1, 2]))
    }))

  it.effect("retainIf", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set = yield* $(TSet.make("a", "aa", "aaa"))
        const removed = yield* $(pipe(set, TSet.retainIf((s) => s === "aa")))
        const a = yield* $(pipe(set, TSet.has("a")))
        const aa = yield* $(pipe(set, TSet.has("aa")))
        const aaa = yield* $(pipe(set, TSet.has("aaa")))
        return [Array.from(removed), a, aa, aaa]
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [["aaa", "a"], false, true, false])
    }))

  it.effect("retainIfDiscard", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set = yield* $(TSet.make("a", "aa", "aaa"))
        yield* $(pipe(set, TSet.retainIfDiscard((s) => s === "aa")))
        const a = yield* $(pipe(set, TSet.has("a")))
        const aa = yield* $(pipe(set, TSet.has("aa")))
        const aaa = yield* $(pipe(set, TSet.has("aaa")))
        return [a, aa, aaa]
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [false, true, false])
    }))

  it.effect("removeIf", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set = yield* $(TSet.make("a", "aa", "aaa"))
        const removed = yield* $(pipe(set, TSet.removeIf((s) => s === "aa")))
        const a = yield* $(pipe(set, TSet.has("a")))
        const aa = yield* $(pipe(set, TSet.has("aa")))
        const aaa = yield* $(pipe(set, TSet.has("aaa")))
        return [Array.from(removed), a, aa, aaa]
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [["aa"], true, false, true])
    }))

  it.effect("removeIfDiscard", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set = yield* $(TSet.make("a", "aa", "aaa"))
        yield* $(pipe(set, TSet.removeIfDiscard((s) => s === "aa")))
        const a = yield* $(pipe(set, TSet.has("a")))
        const aa = yield* $(pipe(set, TSet.has("aa")))
        const aaa = yield* $(pipe(set, TSet.has("aaa")))
        return [a, aa, aaa]
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [true, false, true])
    }))

  it.effect("transform", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3),
        STM.tap(TSet.transform((n) => n * 2)),
        STM.flatMap(TSet.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [2, 4, 6])
    }))

  it.effect("transform - and shrink", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3),
        STM.tap(TSet.transform(() => 1)),
        STM.flatMap(TSet.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [1])
    }))

  it.effect("transformSTM", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3),
        STM.tap(TSet.transformSTM((n) => STM.succeed(n * 2))),
        STM.flatMap(TSet.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [2, 4, 6])
    }))

  it.effect("transformSTM - and shrink", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3),
        STM.tap(TSet.transformSTM(() => STM.succeed(1))),
        STM.flatMap(TSet.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [1])
    }))

  it.effect("size", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TSet.make(1, 2, 3, 4),
        STM.flatMap(TSet.size)
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 4)
    }))

  it.effect("union", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const set1 = yield* $(TSet.make(1, 2, 3))
        const set2 = yield* $(TSet.make(1, 4, 5))
        yield* $(pipe(set1, TSet.union(set2)))
        return yield* $(TSet.toReadonlyArray(set1))
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5])
    }))
})
