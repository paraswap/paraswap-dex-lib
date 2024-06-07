export type CompoundData = {
  fromCToken: boolean;
};

export type CompoundParam = [srcAmount: string];

export enum CompoundFunctions {
  redeem = 'redeem',
  mint = 'mint',
}
