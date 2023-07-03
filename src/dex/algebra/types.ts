import { Address, NumberAsString } from '../../types';
import { Tick } from './lib/TickManager';

type GlobalState = {
  price: bigint; // The square root of the current price in Q64.96 format
  tick: bigint; // The current tick
  fee: bigint; // The current fee in hundredths of a bip, i.e. 1e-6
  timepointIndex: bigint; // The index of the last written timepoint
  communityFeeToken0: bigint; // The community fee represented as a percent of all collected fee in thousandths (1e-3)
  communityFeeToken1: bigint;
  unlocked: boolean; // True if the contract is unlocked, otherwise - false
};

export type PoolState = {
  pool: Address;

  totalFeeGrowth0Token: bigint;
  totalFeeGrowth1Token: bigint;

  globalState: GlobalState;

  liquidity: bigint;
  volumePerLiquidityInBlock: bigint;

  liquidityCooldown: bigint;
  activeIncentive: Address;

  //mapping(int24 => TickManager.Tick) public override ticks;
  ticks: Record<NumberAsString, Tick>;

  //mapping(int16 => uint256) public override tickTable;
  tickTable: Record<NumberAsString, bigint>;

  balance0: bigint;
  balance1: bigint;
};

export type AlgebraData = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
  }[];
  isApproved?: boolean;
};

export type DexParams = {
  router: Address;
  quoter: Address;
  factory: Address;
  algebraStateMulticall: Address;
  uniswapMulticall: Address;
  chunksCount: number;
  deployer: Address;
  subgraphURL: string;
  initHash: string;
};
