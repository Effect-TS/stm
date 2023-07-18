import * as Effect from "@effect/io/Effect"
import * as STM from "@effect/stm/STM"

const transaction = STM.flatMap(
  STM.succeed(0),
  (n) => STM.fail(new Error(`n: ${n}`))
)

Effect.runFork(Effect.catchAllCause(transaction, Effect.logError))
