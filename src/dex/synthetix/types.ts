import { Address, Token } from '../../types';

export type LatestRoundData = {
  answer: bigint;
  updatedAt: number;
};

export type Slot0 = {
  sqrtPriceX96: bigint;
  tick: bigint;
  observationIndex: bigint;
  observationCardinality: bigint;
  observationCardinalityNext: bigint;
  feeProtocol: bigint;
};

export type OracleObservation = {
  blockTimestamp: bigint;
  tickCumulative: bigint;
  secondsPerLiquidityCumulativeX128: bigint;
  initialized: boolean;
};

export type PoolState = {
  atomicExchangeFeeRate: Record<string, bigint>;
  exchangeFeeRate: Record<string, bigint>;
  pureChainlinkPriceForAtomicSwapsEnabled: Record<string, boolean>;
  atomicEquivalentForDexPricing: Record<string, Token>;
  atomicTwapWindow: bigint;
  aggregators: Record<string, LatestRoundData>;
  dexPriceAggregator: {
    weth: Address;
    defaultPoolFee: bigint;
    uniswapV3Factory: Address;
    overriddenPoolForRoute: Record<string, Address>;
    uniswapV3Slot0: Record<string, Slot0>;
    // poolAddress -> observationIndex -> Observation
    uniswapV3Observations: Record<string, Record<number, OracleObservation>>;
  };
  blockTimestamp: bigint;
};

export type SynthetixData = {
  // TODO: SynthetixData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  readProxyAddressResolver: Address;
};
