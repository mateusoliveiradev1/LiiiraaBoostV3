export interface Clock {
  now(): Date;
}

export interface IdSource {
  next(): string;
}

export class FrozenClock implements Clock {
  readonly #epochMilliseconds: number;

  constructor(instant: Date | string | number) {
    const epochMilliseconds = new Date(instant).getTime();
    if (!Number.isFinite(epochMilliseconds)) {
      throw new TypeError('FrozenClock requires a valid instant.');
    }

    this.#epochMilliseconds = epochMilliseconds;
  }

  now(): Date {
    return new Date(this.#epochMilliseconds);
  }
}

export class SequenceIds implements IdSource {
  readonly #values: readonly string[];
  #cursor = 0;

  constructor(values: readonly string[]) {
    this.#values = Object.freeze([...values]);
  }

  next(): string {
    const value = this.#values[this.#cursor];
    if (value === undefined) {
      throw new Error('SequenceIds exhausted its deterministic values.');
    }

    this.#cursor += 1;
    return value;
  }
}
