import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { AaveV3Ethereum, MiscEthereum } from '@bgd-labs/aave-address-book';

export const AaveGsmConfig: DexConfigMap<DexParams> = {
  AaveGsm: {
    [Network.MAINNET]: {
      GSM_USDT: MiscEthereum.GSM_USDT,
      GSM_USDC: MiscEthereum.GSM_USDC,
      USDT: AaveV3Ethereum.ASSETS.USDT.UNDERLYING,
      USDC: AaveV3Ethereum.ASSETS.USDC.UNDERLYING,
      GHO: AaveV3Ethereum.ASSETS.GHO.UNDERLYING,
      USDT_PRICE_FEED: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
      USDC_PRICE_FEED: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
