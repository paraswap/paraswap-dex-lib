import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';

// const SUPPORTED_FEES = [3000n];
const SUPPORTED_FEES = [500n];
const SUPPORTED_TICK_SPACINGS = [1n, 10n, 50n, 100n];

// Pools that will be initialized on app startup
// They are added for testing
export const PoolsToPreload: DexConfigMap<
  { token0: Address; token1: Address }[]
> = {
  SolidlyV3: {
    [Network.MAINNET]: [
      {
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
      },
      {
        token0: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'.toLowerCase(),
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
      },
      {
        token0: '0x514910771AF9Ca656af840dff83E8264EcF986CA'.toLowerCase(),
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
      },
      {
        token0: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'.toLowerCase(),
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
      },
      {
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
        token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
      },
      {
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
        token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(),
      },
    ],
  },
};

export const SolidlyV3Config: DexConfigMap<DexParams> = {
  SolidlyV3: {
    [Network.MAINNET]: {
      // factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      factory: '0x70Fe4a44EA505cFa3A57b95cF2862D4fd5F0f687',
      quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedTickSpacings: SUPPORTED_TICK_SPACINGS,
      stateMulticall: '0xb229563028302AA693EEaD62F80CC331aEDE4e26',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      // OG uniswap initHash
      // initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      // Solidly initHash prior to callbacks
      // initHash: `0x2d6541efe1e24667ba5408a35ae420462924d43db1251d7580804ac81545109b`,
      // Solidly initHash after callbacks
      initHash: `0xe9b68c5f77858eecac2e651646e208175e9b1359d68d0e14fc69f8c54e5010bf`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/solidlylabs/solidly-v3',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter01', index: 6 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 2 }],
  },
};
