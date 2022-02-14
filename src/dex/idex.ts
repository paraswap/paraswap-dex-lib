import { AsyncOrSync } from 'ts-essentials';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
  Address,
  SimpleExchangeParam,
  AdapterExchangeParam,
  TxInfo,
  NumberAsString,
  Token,
  ExchangePrices,
  PoolLiquidity,
} from '../types';
import { SwapSide, Network } from '../constants';
import { IDexHelper } from '../dex-helper/idex-helper';

export interface IDexTxBuilder<ExchangeData, DirectParam> {
  needWrapNative: boolean;

  getNetworkFee?(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ExchangeData,
    side: SwapSide,
  ): NumberAsString;

  // Used for multiSwap, buy & megaSwap
  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString, // required for buy case
    data: ExchangeData,
    side: SwapSide,
  ): AdapterExchangeParam;
  // Used for simpleSwap & simpleBuy
  getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ExchangeData,
    side: SwapSide,
  ): AsyncOrSync<SimpleExchangeParam>;
  // Used if there is a possibility for direct swap (Eg. UniswapV2, 0xV2/V4, etc)
  getDirectParam?(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ExchangeData,
    side: SwapSide,
    contractMethod?: string,
  ): TxInfo<DirectParam>;
}

export interface IDexPricing<ExchangeData> {
  // This is true if the the DEX is simply
  // wrapping/ unwrapping like weth, lending pools, etc
  // or has a pool where arbitarily large amounts has
  // constant price.
  readonly hasConstantPriceLargeAmounts: boolean;

  getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): AsyncOrSync<string[]>;

  getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    // list of pool identifiers to use for pricing, if undefined use all pools
    limitPools?: string[],
  ): Promise<ExchangePrices<ExchangeData> | null>;

  initialize?(blockNumber: number): AsyncOrSync<void>;

  getAdapters(): { name: string; index: number }[];
}

export interface IDexPooltracker {
  // This is called once before getTopXPoolsForToken is called for multiple tokens
  // This can be helpful to update common state required for calculating getTopXPoolsForToken
  updatePoolState?(): AsyncOrSync<void>;

  getTopPoolsForToken(
    token: Token,
    count: number,
  ): AsyncOrSync<PoolLiquidity[]>;
}

// TODO: refactor the name to IDex
export interface IDex<
  ExchangeData,
  DirectParam,
  OptimizedExchangeData = ExchangeData,
> extends IDexTxBuilder<OptimizedExchangeData, DirectParam>,
    IDexPricing<ExchangeData>,
    IDexPooltracker {}

export interface DexContructor<ExchangeData, DirectParam> {
  new (network: Network, dexKey: string, dexHelper: IDexHelper): IDex<
    ExchangeData,
    DirectParam
  >;

  dexKeysWithNetwork: { key: string; networks: Network[] }[];
}
