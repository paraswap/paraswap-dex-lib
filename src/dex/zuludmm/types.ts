import { EventFragment } from '@ethersproject/abi';
import { BigNumberish } from '@ethersproject/bignumber';
import { ValueOf } from 'ts-essentials';
import { Address, Token } from '../../types';

export type ZuluDmmSellParam = [
  srcAmount: string,
  destAmount: string,
  pools: string[],
  path: string[],
  to: string,
  deadline: string,
];

export type ZuluDmmBuyParam = [
  destAmount: string,
  srcAmount: string,
  pools: string[],
  path: string[],
  to: string,
  deadline: string,
];

export type ZuluDmmParam = ZuluDmmBuyParam | ZuluDmmSellParam;

export enum ZuluDMMFunctions {
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
}

export type ZuluDmmData = {
  router: Address;
  path: Address[];
  pools: {
    address: Address;
    direction: boolean;
    fee: number;
  }[];
  factory: Address;
};

export type TradeInfo = {
  reserves0: bigint;
  reserves1: bigint;
  vReserves0: bigint;
  vReserves1: bigint;
  feeInPrecision: bigint;
};

export type ZuluDmmAbiEventMap = {
  Sync: {
    readonly eventFragment: EventFragment;
    readonly name: 'Sync';
    readonly signature: 'Sync(uint256,uint256,uint256,uint256)';
    readonly topic: '0x2f9d55abfefdfd4c3a83e00a1b419b3c2fe4b83100c559f0e2213e57f6e0bba9';
    readonly args: {
      reserve0: BigNumberish;
      reserve1: BigNumberish;
      vReserve0: BigNumberish;
      vReserve1: BigNumberish;
    };
  };
  UpdateEMA: {
    readonly eventFragment: EventFragment;
    readonly name: 'UpdateEMA';
    readonly signature: 'UpdateEMA(uint256,uint256,uint128,uint256)';
    readonly topic: '0x96e2c334d3c0fa98c8b728ee84471864ffe5b28e05f46e52f8a469d0ab3a8b8b';
    readonly args: {
      shortEMA: BigNumberish;
      longEMA: BigNumberish;
      lastBlockVolume: BigNumberish;
      skipBlock: BigNumberish;
    };
  };
};

export type ZuluDmmAbiEvents = ValueOf<ZuluDmmAbiEventMap>;

export type DexParams = {
  subgraphURL: string;
  routerAddress: Address;
  factoryAddress: Address;
  adapters?: { [side: string]: { name: string; index: number }[] | null };
  poolGasCost?: number;
};
