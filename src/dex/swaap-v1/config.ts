import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MAX_GAS_COST_ESTIMATION = 475 * 1000;
export const SUBGRAPH_TIMEOUT = 1000 * 10;
export const MAX_POOL_CNT = 1000;
export const POOL_CACHE_TTL = 60 * 60; // 1hr

export const SwaapV1Config: DexConfigMap<DexParams> = {
  SwaapV1: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/swaap-labs/swaapv1',
      exchangeProxy: '0x718cc95685a0b0af73c2c8534243039a28687037',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonAdapter01',
        index: 1,
      },
    ],
  },
};

export const SUBGRAPH_FETCH_ALL_POOOLS_RQ = `query ($count: Int) {
  pools: pools(first: $count, orderBy: liquidity, orderDirection: desc, where: {finalized: true}) {
    id
    tokens {
      address
      decimals
      oracleInitialState {
        proxy
        price: fixedPointPrice
        decimals
      }
    }
    liquidityUSD: liquidity
    swapFee
    dynamicCoverageFeesZ
    dynamicCoverageFeesHorizon
    priceStatisticsLookbackInSec
    priceStatisticsLookbackInRound
    priceStatisticsLookbackStepInRound
    maxPriceUnpegRatio
  }
}`;
