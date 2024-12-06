export type ETHxPoolState = {
  ETHxToETHRateFixed: bigint;
};

export type StaderData = {};

export type DexParams = {
  ETHx: string;
  SSPM: string;
  StaderOracle: string;
};

export enum SSPMFunctions {
  deposit = 'deposit',
}
