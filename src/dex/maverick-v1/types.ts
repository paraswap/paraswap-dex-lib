import { Address, NumberAsString } from '../../types';

export type Bin = {
  reserveA: bigint;
  reserveB: bigint;
  kind: bigint;
  lowerTick: bigint;
  mergeId: bigint;
};

export type PoolState = {
  activeTick: bigint;
  binCounter: bigint;
  bins: { [id: string]: Bin };
  binPositions: {
    [tick: string]: {
      [kind: string]: bigint;
    };
  };
  binMap: { [id: string]: bigint };
};

export interface SubgraphToken {
  id: string;
  symbol: string;
  name: string;
}

export interface SubgraphPoolBase {
  id: string;
  tickSpacing: number;
  fee: number;
  lookback: number;
  protocolFeeRatio: number;
  tokenA: SubgraphToken;
  tokenB: SubgraphToken;
}

export type MaverickV1Data = {
  tickSpacing: number;
  fee: number;
  lookback: number;
  protocolFeeRatio: number;
  pool: Address;
  tokenA: Address;
  tokenB: Address;
  exchange: Address;
  deadline?: number;
};

export enum MaverickV1Functions {
  exactInputSingle = 'exactInputSingle',
  exactOutputSingle = 'exactOutputSingle',
}

export type MaverickV1SellParam = {
  tokenIn: Address;
  tokenOut: Address;
  pool: Address;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
  sqrtPriceLimitD18: NumberAsString;
};

export type MaverickV1BuyParam = {
  tokenIn: Address;
  tokenOut: Address;
  pool: Address;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
  sqrtPriceLimitD18: NumberAsString;
};

export type MaverickV1Param = MaverickV1SellParam | MaverickV1BuyParam;

export type DexParams = {
  routerAddress: string;
  poolInspectorAddress: string;
  subgraphURL: string;
};
