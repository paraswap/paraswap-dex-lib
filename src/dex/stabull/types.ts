export type PoolState = {
  reserves0: string;
  reserves1: string;
};

export type StabullData = {
  exchange: string; // The address of the exchange contract
  poolAddress?: string; // The address of the pool being used
  secondPoolAddress: string;
  quoteCurrency: string;
  factory?: string; // The address of the factory
  isMultihop: boolean;
};

export type DexParams = {
  factory: string;
  router: string;
  curve: string;
  quoteCurrency: string;
  pools: {
    [address: string]: {
      id: string;
      source: string;
      pool: string;
      tokens: string[];
      lpt: string;
      tokenAssim: string;
      usdcAssim: string;
    };
  };
};

export type DexConfigMap<T> = {
  Stabull: {
    [network: number]: T;
  };
};

export type PoolConfig = {
  id: string;
  source: string;
  pool: string;
  tokens: string[];
  lpt: string;
  tokenAssim: string;
  usdcAssim: string;
};

export type PoolsConfig = {
  [poolAddress: string]: PoolConfig;
};
