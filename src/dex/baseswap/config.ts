import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';
// import RamsesV2StateMulticallABI from '../../abi/RamsesV2StateMulticall.abi.json';
// import { AbiItem } from 'web3-utils';
// import { decodeStateMultiCallResultWithRelativeBitmaps } from './forks/ramses-v2/utils';
// import { RamsesV2EventPool } from './forks/ramses-v2/ramses-v2-pool';

const SUPPORTED_FEES = [10000n, 2500n, 450n, 80n];

// Pools that will be initialized on app startup
// They are added for testing
export const PoolsToPreload: DexConfigMap<
  { token0: Address; token1: Address }[]
> = {
  UniswapV3: {
    [Network.POLYGON]: [
      {
        token0: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
      {
        token0: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
    ],
  },
};

export const BaseswapV3Config: DexConfigMap<DexParams> = {
  UniswapV3: {
    [Network.BASE]: {
      factory: '0x38015D05f4fEC8AFe15D7cc0386a126574e8077B',
      quoter: '0x4fDBD73aD4B1DDde594BF05497C15f76308eFfb9',
      router: '0x1B8eea9315bE495187D873DA7773a874545D9D48',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x7160f736c52e1e78e92FD4eE4D73e21A7Cf4F950',
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/baseswapfi/v3-base',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'Adapter01', index: 6 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 2 }],
  },
};
