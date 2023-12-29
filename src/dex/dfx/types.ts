import { JsonFragment } from '@ethersproject/abi';
import { Address, NumberAsString, Token } from '../../types';
import { DecodeStateMultiCallFunc } from '../uniswap-v3/types';
import { UniswapV3EventPool } from '../uniswap-v3/uniswap-v3-pool';
import { AbiItem } from 'web3-utils';

export type PoolState = {
  pool: string;
  blockTimestamp: bigint;
  fee: bigint;
  liquidity: bigint;
  balance0: bigint;
  balance1: bigint;
};

export interface DFXPoolConfig {
  coins: Token[];
  address: Address;
  name: string;
  isMetapool: boolean;
  isUSDPool: boolean;
  lpToken: Token;
}

export interface DFXV3OriginSwap {
  _originAmount: string;
  _minTargetAmount: string;
  _path: string[];
  _deadline: string;
}
export type DfxData = {
  // TODO: DfxData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  path: {
    tokenIn: Address;
    tokenOut: Address;
    fee: NumberAsString;
  }[];
};

export interface PoolInfo {
  id: string;
  source: 'dfx' | 'curve' | 'balancer' | 'sushi';
  pool: string;
  lpt: string;
  tokens: Address[];
}

export type DexParams = {
  router: Address;
  factory: Address;
  curve: Address;
  subgraphURL: string;
  pools: Partial<Record<string, PoolInfo>>;
};
