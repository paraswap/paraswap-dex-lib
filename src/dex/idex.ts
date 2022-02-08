import { AsyncOrSync } from 'ts-essentials';
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
import { SwapSide } from '../constants';
import { JsonRpcProvider } from '@ethersproject/providers';

// TODO: refactor the name to IDexTxBuilder
export interface IDex<ExchangeData, DirectParam> {
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
  hasConstantPriceLargeAmounts(): boolean;

  getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
  ): AsyncOrSync<string[]>;

  getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    includePools: string[], // list of pool identifiers
  ): Promise<ExchangePrices<ExchangeData> | null>;

  startListening?(): AsyncOrSync<void>;

  getAdapters(): { adapter: Address; index: number }[];
}

export interface IDexPooltracker {
  updatePoolState(): AsyncOrSync<void>;

  getTopXPoolsForToken(token: Token, cnt: number): AsyncOrSync<PoolLiquidity[]>;
}

// TODO: refactor the name to IDex
export interface IDexComplete<ExchangeData, DirectParam>
  extends IDex<ExchangeData, DirectParam>,
    IDexPricing<ExchangeData>,
    IDexPooltracker {}

export interface DexContructor<ExchangeData, DirectParam> {
  new (
    augustusAddress: Address,
    network: number,
    provider: JsonRpcProvider,
    dexKey: string,
  ): IDexComplete<ExchangeData, DirectParam>;

  dexKeysWithNetwork: [string, number][];
}
