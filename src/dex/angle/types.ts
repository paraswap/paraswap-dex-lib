import { Address, Token } from '../../types';

export type PoolState = {
  collateralMaps: {
    [token: string]: CollateralMap;
  };
};

export type AngleData = {};

export type CollateralMap = {
  token: string;
  sanToken: string;
  perpetualManager: string;
  oracle: string;
  stocksUsers: bigint;
  sanRate: bigint;
  collatBase: bigint;
  slpData: {
    lastBlockUpdated: bigint;
    lockedInterests: bigint;
    maxInterestsDistributed: bigint;
    feesAside: bigint;
    slippageFee: bigint;
    feesForSLPs: bigint;
    slippage: bigint;
    interestsForSLPs: bigint;
  };
  feeData: {
    xFeeMint: bigint[];
    yFeeMint: bigint[];
    xFeeBurn: bigint[];
    yFeeBurn: bigint[];
    targetHAHedge: bigint;
    bonusMalusMint: bigint;
    bonusMalusBurn: bigint;
    capOnStableMinted: bigint;
  };
};

export enum TokenType {
  AgToken,
  Collateral,
}

export type AngleToken = Token & {
  type: TokenType;
  poolManager: Address;
};

export type DexParams = {
  agEUR: {
    address: Address;
    decimals: number;
    collaterals: {
      [collateral: string]: AngleToken;
    };
    stableMaster: Address;
  };
};
