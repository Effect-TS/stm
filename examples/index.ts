import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as STM from "@effect/stm/STM"
import * as TRef from "@effect/stm/TRef"

const transfer = (
  receiver: TRef.TRef<number>,
  sender: TRef.TRef<number>,
  much: number
): Effect.Effect<never, never, number> =>
  pipe(
    TRef.get(sender),
    STM.tap((balance) => STM.check(() => balance >= much)),
    STM.tap(() => pipe(receiver, TRef.update((n) => n + much))),
    STM.tap(() => pipe(sender, TRef.update((n) => n - much))),
    STM.zipRight(TRef.get(receiver)),
    STM.commit
  )

const program = Effect.gen(function*($) {
  const sender = yield* $(TRef.make(100))
  const receiver = yield* $(TRef.make(0))
  yield* $(Effect.fork(transfer(receiver, sender, 150)))
  yield* $(pipe(sender, TRef.update((n) => n + 100)))
  yield* $(pipe(TRef.get(sender), STM.retryUntil((n) => n === 50)))
  const senderValue = yield* $(TRef.get(sender))
  const receiverValue = yield* $(TRef.get(receiver))
  console.log({ senderValue })
  console.log({ receiverValue })
})

Effect.runCallback(program, console.log)
