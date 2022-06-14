import { Address } from '../../types';

export type MaverickPoolState = {
  quoteBalance: bigint;
  baseBalance: bigint;
  u: bigint;
  twau: bigint;
  lastTimestamp: bigint;
};

export type MaverickData = {
  w: number;
  k: number;
  h: number;
  fee: number;
  paramChoice: number;
  router: Address;
  pool: Address;
  quote: Address;
  base: Address;
};

export interface SubgraphToken {
  id: string;
  symbol: string;
  name: string;
}

export interface SubgraphPoolBase {
  id: string;
  w: number;
  k: number;
  h: number;
  fee: number;
  paramChoice: number;
  twauLookback: number;
  uShiftMultiplier: number;
  maxSpreadFee: number;
  spreadFeeMultiplier: number;
  protocolFeeRatio: number;
  epsilon: number;
  quote: SubgraphToken;
  base: SubgraphToken;
}

export type DexParams = {
  subgraphURL: string;
  factoryAddress: string;
  routerAddress: string;
  estimatorAddress: string;
};
