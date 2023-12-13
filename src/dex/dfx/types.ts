import { JsonFragment } from '@ethersproject/abi';
import { Address, NumberAsString, Token } from '../../types';
import { DecodeStateMultiCallFunc } from '../uniswap-v3/types';
import { UniswapV3EventPool } from '../uniswap-v3/uniswap-v3-pool';
import { AbiItem } from 'web3-utils';

export type PoolState = {
  initialA: bigint;
  futureA: bigint;
  initialATime: bigint;
  futureATime: bigint;
  swapFee: bigint;
  adminFee: bigint;
  defaultDepositFee?: bigint;
  defaultWithdrawFee?: bigint;
  lpToken_supply: bigint;
  balances: bigint[];
  isValid: boolean;
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

export type DexParams = {
  router: Address;
  factory: Address;
};
