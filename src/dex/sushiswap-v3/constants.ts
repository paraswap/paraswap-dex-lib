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
import { Chain } from 'viem';

export function getViemChain(network: Network): Chain {
  switch (network) {
    case Network.ARBITRUM:
      return arbitrum;
    case Network.AVALANCHE:
      return avalanche;
    case Network.BSC:
      return bsc;
    case Network.FANTOM:
      return fantom;
    case Network.MAINNET:
      return mainnet;
    case Network.OPTIMISM:
      return optimism;
    case Network.POLYGON:
      return polygon;
    default:
      throw new Error(`Chain with id ${network} is not supported`);
  }
}
