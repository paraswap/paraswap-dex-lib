import { Address } from '@paraswap/core';
import { Network } from '../../constants';

// We use dodo-v2 proxy as the new proxy supports both v1 and v2
export const DODOV2ProxyAddress: { [network: number]: Address } = {
  [Network.MAINNET]: '0xa356867fdcea8e71aeaf87805808803806231fdc',
  [Network.BSC]: '0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486',
  [Network.ARBITRUM]: '0x88CBf433471A0CD8240D2a12354362988b4593E5',
};

export const DODOAproveAddress: { [network: number]: Address } = {
  [Network.MAINNET]: '0xCB859eA579b28e02B87A1FDE08d087ab9dbE5149',
  [Network.BSC]: '0xa128Ba44B2738A558A1fdC06d6303d52D3Cef8c1',
  [Network.ARBITRUM]: '0xA867241cDC8d3b0C07C85cC06F25a0cD3b5474d8',
};
