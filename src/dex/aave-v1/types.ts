import { Address } from '../../types';

export type AaveV1Data = {
  fromAToken: boolean;
  isV2: boolean;
  // TODO: AaveV1Data is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};

export type AaveV1RedeemParams = [
  _reserve: string,
  _amount: string,
  _referralCode: number,
];
export type AaveV1DepositParams = [token: string];
export type AaveV1Param = AaveV1RedeemParams | AaveV1DepositParams;
