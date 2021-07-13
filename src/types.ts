export type Address = string;

export enum SwapSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export type OptimalRate = {
  // TODO: comple the new api return type
}

// TODO: fix the type
export type EncodeContractMethod = (...args: any[]) => any

export type DexMap = {[identifier: string]: IDex<any, any>};