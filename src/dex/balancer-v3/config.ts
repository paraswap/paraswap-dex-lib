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
      vaultAddress: '0x30AF3689547354f82C70256894B07C9D0f067BB6',
      apiNetworkName: 'SEPOLIA',
      balancerRouterAddress: '0x77eDc69766409C599F06Ef0B551a0990CBfe13A7',
      balancerBatchRouterAddress: '0x16Cf31c5c4f92ad6185D583080C84FEeb6074c78',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
