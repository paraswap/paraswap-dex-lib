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
      vaultAddress: '0xBC582d2628FcD404254a1e12CB714967Ce428915',
      apiNetworkName: 'SEPOLIA',
      balancerRouterAddress: '0x4D2aA7a3CD7F8dA6feF37578A1881cD63Fd3715E',
      balancerBatchRouterAddress: '0x4232e5EEaA16Bcf483d93BEA469296B4EeF22503',
    },
  },
};
