export enum OrderStatus {
  INVALID, // Default value
  INVALID_MAKER_ASSET_AMOUNT, // Order does not have a valid maker asset amount
  INVALID_TAKER_ASSET_AMOUNT, // Order does not have a valid taker asset amount
  FILLABLE, // Order is fillable
  EXPIRED, // Order has already expired
  FULLY_FILLED, // Order is fully filled
  CANCELLED, // Order has been cancelled
}

export interface ZeroXSignedOrderV2 {
  senderAddress: string;
  makerAddress: string;
  takerAddress: string;
  makerFee: BigInt;
  takerFee: BigInt;
  makerAssetAmount: BigInt;
  takerAssetAmount: BigInt;
  makerAssetData: string;
  takerAssetData: string;
  salt: BigInt;
  exchangeAddress: string;
  feeRecipientAddress: string;
  expirationTimeSeconds: BigInt;
  makerFeeAssetData: string;
  takerFeeAssetData: string;
  signature: string;
}

export interface ZeroXSignedOrderV4 {
  makerToken: string;
  takerToken: string;
  makerAmount: BigInt;
  takerAmount: BigInt;
  maker: string;
  taker: string;
  txOrigin: string;
  pool: string;
  expiry: BigInt;
  salt: BigInt;
}

export type ZeroXSignedOrder = ZeroXSignedOrderV2 | ZeroXSignedOrderV4
