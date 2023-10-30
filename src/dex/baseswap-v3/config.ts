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
  BaseswapV3: {
    [Network.BASE]: [
      {
        token0: '0x4200000000000000000000000000000000000006'.toLowerCase(),
        token1: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'.toLowerCase(), // USDbC
      },
      {
        token0: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase(), // USDC
        token1: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'.toLowerCase(), // USDbC
      },
    ],
  },
};

export const BaseswapV3Config: DexConfigMap<DexParams> = {
  BaseswapV3: {
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
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 1 }],
    [SwapSide.BUY]: [{ name: 'BaseBuyAdapter', index: 1 }],
  },
};
