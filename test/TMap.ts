import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as STM from "@effect/stm/STM"
import * as it from "@effect/stm/test/utils/extend"
import * as TMap from "@effect/stm/TMap"
import * as Equal from "@fp-ts/data/Equal"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray"
import * as fc from "fast-check"
import { assert, describe } from "vitest"

class HashContainer implements Equal.Equal {
  constructor(readonly i: number) {}
  [Equal.symbolHash](): number {
    return this.i
  }
  [Equal.symbolEqual](that: unknown): boolean {
    return that instanceof HashContainer && this.i === that.i
  }
}

const mapEntriesArb: fc.Arbitrary<Array<readonly [string, number]>> = fc.uniqueArray(fc.char())
  .chain((keys) =>
    fc.uniqueArray(fc.integer())
      .map((values) => pipe(keys, ReadonlyArray.zip(values)))
  )

describe.concurrent("TMap", () => {
  it.effect("delete - remove an existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2]),
        STM.tap(TMap.delete("a")),
        STM.flatMap(TMap.get("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, Option.none)
    }))

  it.effect("delete - remove an non-existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.tap(TMap.delete("a")),
        STM.flatMap(TMap.get("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, Option.none)
    }))

  it.effect("deleteIf", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const map = yield* $(TMap.make(["a", 1], ["aa", 2], ["aaa", 3]))
        const removed = yield* $(pipe(map, TMap.deleteIf((_, value) => value > 1)))
        const a = yield* $(pipe(map, TMap.has("a")))
        const aa = yield* $(pipe(map, TMap.has("aa")))
        const aaa = yield* $(pipe(map, TMap.has("aaa")))
        return [Array.from(removed), a, aa, aaa] as const
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [[["aaa", 3], ["aa", 2]], true, false, false])
    }))

  it.effect("deleteIfDiscard", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const map = yield* $(TMap.make(["a", 1], ["aa", 2], ["aaa", 3]))
        yield* $(pipe(map, TMap.deleteIfDiscard((key) => key === "aa")))
        const a = yield* $(pipe(map, TMap.has("a")))
        const aa = yield* $(pipe(map, TMap.has("aa")))
        const aaa = yield* $(pipe(map, TMap.has("aaa")))
        return [a, aa, aaa] as const
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [true, false, true])
    }))

  it.effect("empty", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.flatMap(TMap.isEmpty)
      )
      const result = yield* $(STM.commit(transaction))
      assert.isTrue(result)
    }))

  it.effect("fromIterable", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.fromIterable([["a", 1], ["b", 2], ["c", 2], ["b", 3]]),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [["a", 1], ["b", 3], ["c", 2]])
    }))

  it.effect("get - existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2]),
        STM.flatMap(TMap.get("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, Option.some(1))
    }))

  it.effect("get - non-existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.flatMap(TMap.get("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, Option.none)
    }))

  it.effect("getOrElse - existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2]),
        STM.flatMap(TMap.getOrElse("a", () => 10))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, 1)
    }))

  it.effect("getOrElse - non-existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.flatMap(TMap.getOrElse("a", () => 10))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, 10)
    }))

  it.effect("has - existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2]),
        STM.flatMap(TMap.has("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.isTrue(result)
    }))

  it.effect("has - non-existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.flatMap(TMap.has("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.isFalse(result)
    }))

  it.it("keys - collect all keys", () =>
    fc.assert(fc.asyncProperty(mapEntriesArb, async (entries) => {
      const transaction = pipe(
        TMap.fromIterable(entries),
        STM.flatMap(TMap.keys)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      const keys = entries.map((entry) => entry[0])
      assert.lengthOf(pipe(Array.from(result), ReadonlyArray.difference(keys)), 0)
      assert.lengthOf(pipe(keys, ReadonlyArray.difference(result)), 0)
    })))

  it.effect("merge", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1]),
        STM.flatMap((map) =>
          STM.struct({
            result1: pipe(map, TMap.merge("a", 2, (x, y) => x + y)),
            result2: pipe(map, TMap.merge("b", 2, (x, y) => x + y))
          })
        )
      )
      const { result1, result2 } = yield* $(STM.commit(transaction))
      assert.strictEqual(result1, 3)
      assert.strictEqual(result2, 2)
    }))

  it.effect("reduce - non-empty map", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2], ["c", 3]),
        STM.flatMap(TMap.reduce(0, (acc, value) => acc + value))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 6)
    }))

  it.effect("reduce - empty map", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.flatMap(TMap.reduce(0, (acc, value) => acc + value))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 0)
    }))

  it.effect("reduceSTM - non-empty map", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2], ["c", 3]),
        STM.flatMap(TMap.reduceSTM(0, (acc, value) => STM.succeed(acc + value)))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 6)
    }))

  it.effect("reduceSTM - empty map", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.flatMap(TMap.reduceSTM(0, (acc, value) => STM.succeed(acc + value)))
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 0)
    }))

  it.effect("retainIf", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const map = yield* $(TMap.make(["a", 1], ["aa", 2], ["aaa", 3]))
        const removed = yield* $(pipe(map, TMap.retainIf((key) => key === "aa")))
        const a = yield* $(pipe(map, TMap.has("a")))
        const aa = yield* $(pipe(map, TMap.has("aa")))
        const aaa = yield* $(pipe(map, TMap.has("aaa")))
        return [Array.from(removed), a, aa, aaa] as const
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [[["aaa", 3], ["a", 1]], false, true, false])
    }))

  it.effect("retainIfDiscard", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const map = yield* $(TMap.make(["a", 1], ["aa", 2], ["aaa", 3]))
        yield* $(pipe(map, TMap.retainIfDiscard((key) => key === "aa")))
        const a = yield* $(pipe(map, TMap.has("a")))
        const aa = yield* $(pipe(map, TMap.has("aa")))
        const aaa = yield* $(pipe(map, TMap.has("aaa")))
        return [a, aa, aaa] as const
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [false, true, false])
    }))

  it.effect("set - adds new element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.empty<string, number>(),
        STM.tap(TMap.set("a", 1)),
        STM.flatMap(TMap.get("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, Option.some(1))
    }))

  it.effect("set - overwrites an existing element", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["b", 2]),
        STM.tap(TMap.set("a", 10)),
        STM.flatMap(TMap.get("a"))
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, Option.some(10))
    }))

  it.effect("set - add many keys with negative hash codes", () =>
    Effect.gen(function*($) {
      const entries = Array.from({ length: 1_000 }, (_, i) => i + 1)
        .map((i) => [new HashContainer(i), i] as const)
      const transaction = pipe(
        TMap.empty<HashContainer, number>(),
        STM.tap((map) => STM.collectAll(entries.map((entry) => pipe(map, TMap.set(entry[0], entry[1]))))),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(entries)), 0)
      assert.lengthOf(pipe(entries, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("setIfAbsent", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1]),
        STM.tap(TMap.setIfAbsent("b", 2)),
        STM.tap(TMap.setIfAbsent("a", 10)),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      const expected = [["a", 1], ["b", 2]]
      assert.lengthOf(pipe(result, ReadonlyArray.difference(expected)), 0)
      assert.lengthOf(pipe(expected, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("size", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.fromIterable([["a", 1], ["b", 2]]),
        STM.flatMap(TMap.size)
      )
      const result = yield* $(STM.commit(transaction))
      assert.strictEqual(result, 2)
    }))

  it.it("toChunk - collect all elements", () =>
    fc.assert(fc.asyncProperty(mapEntriesArb, async (entries) => {
      const transaction = pipe(
        TMap.fromIterable(entries),
        STM.flatMap(TMap.toChunk)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(Array.from(result), ReadonlyArray.difference(entries)), 0)
      assert.lengthOf(pipe(entries, ReadonlyArray.difference(Array.from(result))), 0)
    })))

  it.it("toReadonlyArray - collect all elements", () =>
    fc.assert(fc.asyncProperty(mapEntriesArb, async (entries) => {
      const transaction = pipe(
        TMap.fromIterable(entries),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(result, ReadonlyArray.difference(entries)), 0)
      assert.lengthOf(pipe(entries, ReadonlyArray.difference(result)), 0)
    })))

  it.it("toReadonlyMap - collect all elements", () =>
    fc.assert(fc.asyncProperty(mapEntriesArb, async (entries) => {
      const transaction = pipe(
        TMap.fromIterable(entries),
        STM.flatMap(TMap.toReadonlyMap)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      assert.lengthOf(pipe(Array.from(result), ReadonlyArray.difference(entries)), 0)
      assert.lengthOf(pipe(entries, ReadonlyArray.difference(Array.from(result))), 0)
    })))

  it.effect("transform", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["aa", 2], ["aaa", 3]),
        STM.tap(TMap.transform((key, value) => [key.replaceAll("a", "b"), value * 2])),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      const expected = [["b", 2], ["bb", 4], ["bbb", 6]]
      assert.lengthOf(pipe(result, ReadonlyArray.difference(expected)), 0)
      assert.lengthOf(pipe(expected, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("transform - handles keys with negative hash codes", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make([new HashContainer(-1), 1], [new HashContainer(-2), 2], [new HashContainer(-3), 3]),
        STM.tap(TMap.transform((key, value) => [new HashContainer(key.i * -2), value * 2])),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      const expected = [[new HashContainer(2), 2], [new HashContainer(4), 4], [new HashContainer(6), 6]]
      assert.lengthOf(pipe(result, ReadonlyArray.difference(expected)), 0)
      assert.lengthOf(pipe(expected, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("transform - and shrink", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["aa", 2], ["aaa", 3]),
        STM.tap(TMap.transform((_, value) => ["key", value * 2])),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [["key", 6]])
    }))

  it.effect("transformSTM", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["aa", 2], ["aaa", 3]),
        STM.tap(TMap.transformSTM((key, value) => STM.succeed([key.replaceAll("a", "b"), value * 2]))),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      const expected = [["b", 2], ["bb", 4], ["bbb", 6]]
      assert.lengthOf(pipe(result, ReadonlyArray.difference(expected)), 0)
      assert.lengthOf(pipe(expected, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("transformSTM - and shrink", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["aa", 2], ["aaa", 3]),
        STM.tap(TMap.transformSTM((_, value) => STM.succeed(["key", value * 2]))),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [["key", 6]])
    }))

  it.effect("transformValues", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["aa", 2], ["aaa", 3]),
        STM.tap(TMap.transformValues((value) => value * 2)),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      const expected = [["a", 2], ["aa", 4], ["aaa", 6]]
      assert.lengthOf(pipe(result, ReadonlyArray.difference(expected)), 0)
      assert.lengthOf(pipe(expected, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("transformValues - parallel", () =>
    Effect.gen(function*($) {
      const map = yield* $(TMap.make(["a", 0]))
      const effect = pipe(
        map,
        TMap.transformValues((n) => n + 1),
        STM.commit,
        Effect.repeatN(999)
      )
      yield* $(Effect.collectAllParDiscard(Array.from({ length: 2 }, () => effect)))
      const result = yield* $(pipe(map, TMap.get("a")))
      assert.deepStrictEqual(result, Option.some(2_000))
    }))

  it.effect("transformValuesSTM", () =>
    Effect.gen(function*($) {
      const transaction = pipe(
        TMap.make(["a", 1], ["aa", 2], ["aaa", 3]),
        STM.tap(TMap.transformValuesSTM((value) => STM.succeed(value * 2))),
        STM.flatMap(TMap.toReadonlyArray)
      )
      const result = yield* $(STM.commit(transaction))
      const expected = [["a", 2], ["aa", 4], ["aaa", 6]]
      assert.lengthOf(pipe(result, ReadonlyArray.difference(expected)), 0)
      assert.lengthOf(pipe(expected, ReadonlyArray.difference(result)), 0)
    }))

  it.effect("updateWith", () =>
    Effect.gen(function*($) {
      const transaction = STM.gen(function*($) {
        const map = yield* $(TMap.make(["a", 1], ["b", 2]))
        yield* $(pipe(map, TMap.updateWith("a", Option.map((n) => n + 1))))
        yield* $(pipe(map, TMap.updateWith<string, number>("b", () => Option.none)))
        yield* $(pipe(map, TMap.updateWith("c", () => Option.some(3))))
        yield* $(pipe(map, TMap.updateWith<string, number>("d", () => Option.none)))
        return yield* $(TMap.toReadonlyArray(map))
      })
      const result = yield* $(STM.commit(transaction))
      assert.deepStrictEqual(result, [["a", 2], ["c", 3]])
    }))

  it.it("values - collect all values", () =>
    fc.assert(fc.asyncProperty(mapEntriesArb, async (entries) => {
      const transaction = pipe(
        TMap.fromIterable(entries),
        STM.flatMap(TMap.values)
      )
      const result = await Effect.unsafeRunPromise(STM.commit(transaction))
      const values = entries.map((entry) => entry[1])
      assert.lengthOf(pipe(Array.from(result), ReadonlyArray.difference(values)), 0)
      assert.lengthOf(pipe(values, ReadonlyArray.difference(result)), 0)
    })))

  it.effect("avoid issues due to race conditions (ZIO Issue #4648)", () =>
    Effect.gen(function*($) {
      const keys = ReadonlyArray.range(0, 10)
      const map = yield* $(TMap.fromIterable(pipe(keys, ReadonlyArray.mapWithIndex((n, i) => [n, i]))))
      const result = yield* $(pipe(
        keys,
        Effect.forEachDiscard((key) =>
          pipe(
            map,
            TMap.delete(key),
            STM.commit,
            Effect.fork,
            Effect.zipRight(pipe(TMap.toChunk(map))),
            Effect.asUnit
          )
        ),
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.unit())
    }))
})
