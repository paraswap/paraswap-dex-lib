import { Network } from '../../constants';
import { UniswapV2Config } from './config';
import { MDEXConfig } from './mdex';
import { BiSwapConfig } from './biswap';
import { DfynConfig } from './dfyn';
import { ExcaliburConfig } from './excalibur';

export const UNISWAP_V2_PAIRS_CACHE_TTL_S = 60 * 60 * 24; // 24 hours

// BakerySwap and Dystopia were removed from AllUniswapForks and UniswapForksWithNetwork
// as they have a modified pool implementation which are not compatible with
// standard contract methods

export const AllUniswapForks = [
  ...Object.keys(UniswapV2Config).filter(dexKey => dexKey !== 'BakerySwap'),
  ...Object.keys(MDEXConfig),
  ...Object.keys(BiSwapConfig),
  ...Object.keys(DfynConfig),
  ...Object.keys(ExcaliburConfig),
];

const transformToNetworkMap = (config: {
  [dexKey: string]: { [network: number]: any };
}) =>
  Object.entries(config).reduce(
    (
      acc: { [network: number]: string[] },
      [dexKey, networkConfig]: [string, { [network: number]: string[] }],
    ) => {
      if (dexKey === 'BakerySwap') return acc;
      Object.keys(networkConfig).forEach((_n: string) => {
        const n = parseInt(_n);
        if (!(n in acc)) acc[n] = [];
        acc[n].push(dexKey.toLowerCase());
      });
      return acc;
    },
    {},
  );

export const UniswapForksWithNetwork = transformToNetworkMap({
  ...UniswapV2Config,
  ...MDEXConfig,
  ...BiSwapConfig,
  ...DfynConfig,
  ...ExcaliburConfig,
});

// These are exchanges used for swapOnUniswap method
export const UniswapV2Alias: { [network: number]: string } = {
  [Network.MAINNET]: 'uniswapv2',
  [Network.ROPSTEN]: 'uniswapv2',
  [Network.BSC]: 'pancakeswap',
  [Network.POLYGON]: 'quickswap',
  [Network.AVALANCHE]: 'pangolinswap',
  [Network.FANTOM]: 'spookyswap',
  [Network.ARBITRUM]: 'sushiswap',
  [Network.OPTIMISM]: 'zipswap',
};
