export type WethData = null;

export type DexParams = {
  contractAddress: string;
  poolGasCost: number;
};

export enum WethFunctions {
  deposit = 'deposit',
  withdraw = 'withdraw',
}
