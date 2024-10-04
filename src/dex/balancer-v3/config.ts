import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

// These map to the Balancer API poolType. Only Balancer supported pools will be added
export enum SUPPORTED_POOLS {
  WEIGHTED = 'WEIGHTED',
  STABLE = 'STABLE',
}

// Balancer API - aggregatorSpecific query serves all useful static pool data
export const apiUrl = 'https://test-api-v3.balancer.fi/';

// TODO Full config added after V3 release
export const BalancerV3Config: DexConfigMap<DexParams> = {
  BalancerV3: {
    [Network.SEPOLIA]: {
      vaultAddress: '0x0EF1c156a7986F394d90eD1bEeA6483Cc435F542',
      apiNetworkName: 'SEPOLIA',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
