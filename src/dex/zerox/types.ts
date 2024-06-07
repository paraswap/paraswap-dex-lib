import { Address } from '@paraswap/sdk';
import { NumberAsString } from '../../types';

export enum OrderStatus {
  INVALID, // Default value
  INVALID_MAKER_ASSET_AMOUNT, // Order does not have a valid maker asset amount
  INVALID_TAKER_ASSET_AMOUNT, // Order does not have a valid taker asset amount
  FILLABLE, // Order is fillable
  EXPIRED, // Order has already expired
  FULLY_FILLED, // Order is fully filled
  CANCELLED, // Order has been cancelled
}

type Value = NumberAsString | number;

export interface ZeroXSignedOrderV2 {
  senderAddress: string;
  makerAddress: string;
  takerAddress: string;
  makerFee: Value;
  takerFee: Value;
  makerAssetAmount: Value;
  takerAssetAmount: Value;
  makerAssetData: string;
  takerAssetData: string;
  salt: Value;
  exchangeAddress: string;
  feeRecipientAddress: string;
  expirationTimeSeconds: Value;
  makerFeeAssetData: string;
  takerFeeAssetData: string;
  signature: string;
}

export interface ZeroXSignedOrderV4 {
  makerToken: string;
  takerToken: string;
  makerAmount: Value;
  takerAmount: Value;
  maker: string;
  taker: string;
  txOrigin: string;
  pool: string;
  expiry: Value;
  salt: Value;
  signature: any; // TODO: fix type
}

export type ZeroXSignedOrder = ZeroXSignedOrderV2 | ZeroXSignedOrderV4;

export enum ZeroXFunctions {
  swapOnZeroXv2 = 'swapOnZeroXv2',
  swapOnZeroXv4 = 'swapOnZeroXv4',
  swapOnZeroXv2WithPermit = 'swapOnZeroXv2WithPermit',
  swapOnZeroXv4WithPermit = 'swapOnZeroXv4WithPermit',
}

export type ZeroXData = {
  version: number;
  order: ZeroXSignedOrder;
};

export type SwapOnZeroXParam = [
  srcToken: Address,
  destToken: Address,
  srcAmount: NumberAsString,
  destAmount: NumberAsString,
  exchange: Address,
  payload: string,
];

export type SwapOnZeroXWithPermitParam = [
  srcToken: Address,
  destToken: Address,
  srcAmount: NumberAsString,
  destAmount: NumberAsString,
  exchange: Address,
  payload: string,
  permit: string,
];

export type ZeroXParam = SwapOnZeroXParam | SwapOnZeroXWithPermitParam;
