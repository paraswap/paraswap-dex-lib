export type BProtocolData = {
  exchange: string;
};

export type BProtocolParam = [
  lusdAmount: string,
  minEthReturn: string,
  dest: string,
];

export enum BProtocolFunctions {
  swap = 'swap',
}
