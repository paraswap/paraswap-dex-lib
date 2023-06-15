import { AlpacaPoolConfigs, DexParams, StablePoolTokens } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const ALPACA_SWAP_GAS_COST = 0;
export const FETCH_TIMEOUT = 10000;

export const AlpacaConfig: DexConfigMap<DexParams> = {
  Alpaca: {
    [Network.BSC]: {
      poolRouter: '0x5E8466ed06f7Acaa78Ab21b0F5FEc6810afcC199',
      Pyth: '0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594',
      latestPriceFeedsURL:
        'https://xc-mainnet.pyth.network/api/latest_price_feeds',
      poolDiamond: '0x18A15bF2Aa1E514dc660Cc4B08d05f9f6f0FdC4e',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 1 }],
  },
};

export const alpacaPoolTokens: AlpacaPoolConfigs = {
  poolTokens: {
    BTCB: {
      Symbol: 'BTCB',
      Address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      PriceId:
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      Decimal: 18,
    },
    ETH: {
      Symbol: 'ETH',
      Address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      PriceId:
        '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      Decimal: 18,
    },
    WBNB: {
      Symbol: 'WBNB',
      Address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      PriceId:
        '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
      Decimal: 18,
    },
    USDC: {
      Symbol: 'USDC',
      Address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      PriceId:
        '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
      Decimal: 18,
    },
    USDT: {
      Symbol: 'USDT',
      Address: '0x55d398326f99059fF775485246999027B3197955',
      PriceId:
        '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
      Decimal: 18,
    },
  },
};

export enum InvestPoolLiquidityDirection {
  ADD = 'add',
  REMOVE = 'remove',
}
