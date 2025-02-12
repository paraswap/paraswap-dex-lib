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
    [Network.GNOSIS]: [],
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
      hooks: [
        {
          type: 'DirectionalFee',
          address: '0xd68372e85d8a14afa5fdb3d506bf765939aaf382',
        },
        {
          type: 'StableSurge',
          factory: '0x9eB9867C1d4B6fd3a7D0dAd3101b5A153b1107Ec',
          address: '0xc0cbcdd6b823a4f22aa6bbdde44c17e754266aef',
        },
      ],
    },
    [Network.GNOSIS]: {
      vaultAddress: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      apiNetworkName: 'GNOSIS',
      balancerRouterAddress: '0x84813aA3e079A665C0B80F944427eE83cBA63617',
      balancerBatchRouterAddress: '0xe2fa4e1d17725e72dcdAfe943Ecf45dF4B9E285b',
    },
    [Network.MAINNET]: {
      vaultAddress: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      apiNetworkName: 'MAINNET',
      balancerRouterAddress: '0x5C6fb490BDFD3246EB0bB062c168DeCAF4bD9FDd',
      balancerBatchRouterAddress: '0x136f1EFcC3f8f88516B9E94110D56FDBfB1778d1',
    },
    [Network.ARBITRUM]: {
      vaultAddress: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      apiNetworkName: 'ARBITRUM',
      balancerRouterAddress: '0x0f08eEf2C785AA5e7539684aF04755dEC1347b7c',
      balancerBatchRouterAddress: '0xaD89051bEd8d96f045E8912aE1672c6C0bF8a85E',
    },
    [Network.BASE]: {
      vaultAddress: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      apiNetworkName: 'BASE',
      balancerRouterAddress: '0x76578ecf9a141296Ec657847fb45B0585bCDa3a6',
      balancerBatchRouterAddress: '0x85a80afee867aDf27B50BdB7b76DA70f1E853062',
    },
  },
};
