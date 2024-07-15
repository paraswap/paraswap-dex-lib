export type PoolState = {
  [symbol: string]: {
    ratio: bigint;
  };
};

export type InceptionDexData = {
  exchange: string;
};

export type DexParams = {
  symbol: string;
  vault: string;
  token: string;
  baseToken: string;
  baseTokenSlug: string;
};
