import { Address } from '../../types';

export interface Token {
  id: Address;
  address: Address;
  symbol: string;
  decimals: string;
}

export interface TokenConverter {
  id: Address;
  address: Address;
  destinationAddress: Address;
  baseAsset: Address;
  paused: boolean;
  priceOracleAddress: Address;
}

export interface PoolConfig {
  address: Address;
  baseAsset: Token;
  priceOracleAddress: Address;
  configs: {
    tokenConverter: TokenConverter;
    tokenIn: Token;
    tokenOut: Token;
    tokenOutBalance: string;
  }[];
}

export type PoolState = Record<
  string,
  { balance: bigint; price: bigint; amountConverted: bigint; amountOut: bigint }
>;

export type VenusData = {
  tokenConverter: Address;
};

export type DexParams = {
  subgraphURL: string;
  baseAssetAddress: Address;
  converterAddress: Address;
  protocolShareReserve: Address;
};

export type MulticallResultOutputs = boolean | bigint | [bigint, bigint];
