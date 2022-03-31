import { Network } from '../../constants';
import { UniswapV2Config } from './config';
import { MDEXConfig } from './mdex';
import { BiSwapConfig } from './biswap';
import { DfynConfig } from './dfyn';
import { RadioShackConfig } from './radioshack';

// BakerySwap is removed from AllUniswapForks and UniswapForksWithNetwork
// as it has a modified pool implementation which is not compatible with
// standard contract methods

export const AllUniswapForks = [
  ...Object.keys(UniswapV2Config).filter(dexKey => dexKey !== 'BakerySwap'),
  ...Object.keys(MDEXConfig),
  ...Object.keys(BiSwapConfig),
  ...Object.keys(DfynConfig),
  ...Object.keys(RadioShackConfig),
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
        acc[n].push(dexKey);
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
  ...RadioShackConfig,
});

// These are exchanges used for swapOnUniswap method
export const UniswapV2Alias: { [network: number]: string } = {
  [Network.MAINNET]: 'UniswapV2',
  [Network.ROPSTEN]: 'UniswapV2',
  [Network.BSC]: 'PancakeSwap',
  [Network.POLYGON]: 'QuickSwap',
  [Network.AVALANCHE]: 'PangolinSwap',
  [Network.FANTOM]: 'SpookySwap',
};
