import * as Equal from "@fp-ts/data/Equal"

/** @internal */
export class Versioned<A> {
  constructor(readonly value: A) {
    Equal.considerByRef(this)
  }
}
