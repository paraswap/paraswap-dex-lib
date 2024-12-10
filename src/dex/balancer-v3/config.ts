import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

// These map to the Balancer API poolType. Only Balancer supported pools will be added
export enum SUPPORTED_POOLS {
  WEIGHTED = 'WEIGHTED',
  STABLE = 'STABLE',
}

export const disabledPoolIds: Record<string, Record<number, string[]>> = {
  BalancerV3: {
    [Network.SEPOLIA]: ['0x0d7291d8bdc6b376aadacbf05b1ef8a8292ef58a'], // incorrect token rate config for 0x978206fae13faf5a8d293fb614326b237684b750 token
  },
};

// Balancer API - aggregatorSpecific query serves all useful static pool data
export const apiUrl = 'https://test-api-v3.balancer.fi/';

// TODO Full config added after V3 release
export const BalancerV3Config: DexConfigMap<DexParams> = {
  BalancerV3: {
    [Network.SEPOLIA]: {
      vaultAddress: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      apiNetworkName: 'SEPOLIA',
      balancerRouterAddress: '0x0BF61f706105EA44694f2e92986bD01C39930280',
      balancerBatchRouterAddress: '0xC85b652685567C1B074e8c0D4389f83a2E458b1C',
    },
  },
};
