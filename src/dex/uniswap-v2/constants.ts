import { Network } from '../../constants';
import { UniswapV2Config } from './config';
import { MDEXConfig } from './mdex';
import { BiSwapConfig } from './biswap';
import { DfynConfig } from './dfyn';
import { ExcaliburConfig } from './excalibur';
import { DystopiaConfig } from './dystopia/config';

// BakerySwap is removed from AllUniswapForks and UniswapForksWithNetwork
// as it has a modified pool implementation which is not compatible with
// standard contract methods

export const AllUniswapForks = [
  ...Object.keys(UniswapV2Config).filter(dexKey => dexKey !== 'BakerySwap'),
  ...Object.keys(MDEXConfig),
  ...Object.keys(BiSwapConfig),
  ...Object.keys(DfynConfig),
  ...Object.keys(ExcaliburConfig),
  ...Object.keys(DystopiaConfig),
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
  ...DystopiaConfig,
});

// These are exchanges used for swapOnUniswap method
export const UniswapV2Alias: { [network: number]: string } = {
  [Network.MAINNET]: 'uniswapv2',
  [Network.ROPSTEN]: 'uniswapv2',
  [Network.BSC]: 'pancakeswap',
  [Network.POLYGON]: 'quickswap',
  [Network.AVALANCHE]: 'pangolinswap',
  [Network.FANTOM]: 'spookyswap',
};
