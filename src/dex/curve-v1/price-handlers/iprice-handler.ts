export interface IPriceHandler<T> {
  getOutputs(
    state: T,
    amounts: [],
    i: number,
    j: number,
    isUnderlying: boolean,
  ): bigint[];
}
