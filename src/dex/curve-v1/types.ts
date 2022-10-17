import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type CurveV1Data = {
  exchange: Address;
  i: number;
  j: number;
  underlyingSwap: boolean;
};

export type PoolConfig = {
  underlying: string[];
  coins: string[];
  address: string;
  name: string;
  isLending: boolean;
  isMetapool: boolean;
  liquidityUSD?: number;
  isFeeOnTransferSupported?: boolean;
};

export type DexParams = {
  factoryAddress: string | null;
  pools: Record<string, PoolConfig>;
};

export enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}

export type CurveV1Ifaces = {
  exchangeRouter: Interface;
};
