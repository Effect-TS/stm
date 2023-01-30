import type * as STM from "@effect/stm/STM"

export type NonEmptyArraySTM = [STM.STM<any, any, any>, ...Array<STM.STM<any, any, any>>]

export type TupleSTM<T extends NonEmptyArraySTM> = {
  [K in keyof T]: [T[K]] extends [STM.STM<any, any, infer A>] ? A : never
}
