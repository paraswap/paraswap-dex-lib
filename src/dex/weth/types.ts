export type WethData = {};

export type DexParams = {
  contractAddress: string;
  poolGasCost: number;
};

export enum WethFunctions {
  deposit = 'deposit',
  withdraw = 'withdraw',
}
