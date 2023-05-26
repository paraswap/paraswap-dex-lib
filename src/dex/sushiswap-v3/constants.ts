import { Chain } from 'viem';
import {
  arbitrum,
  avalanche,
  bsc,
  fantom,
  mainnet,
  optimism,
  polygon,
} from '@sushiswap/viem-config';
import { Network } from '../../constants';

export * from '../uniswap-v3/constants';

export const ViemChain: Record<Network, Chain | undefined> = {
  [Network.ARBITRUM]: arbitrum,
  [Network.AVALANCHE]: avalanche,
  [Network.BSC]: bsc,
  [Network.FANTOM]: fantom,
  [Network.MAINNET]: mainnet,
  [Network.OPTIMISM]: optimism,
  [Network.POLYGON]: polygon,
  [Network.RINKEBY]: undefined,
  [Network.ROPSTEN]: undefined,
};
