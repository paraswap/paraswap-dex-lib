export type PoolState = {
  ratio: bigint;
};

export type InceptionData = {
  ratio: bigint;
};

export type DexParams = {
  vault: string;
  token?: string;
  baseTokenSlug: string;
};
