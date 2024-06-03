import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const CustomCdos: Record<string, number> = {
  '0x8E0A8A5c1e5B3ac0670Ea5a613bB15724D51Fc37': 17712300, // Instadapp
};

export const Config: DexConfigMap<DexParams> = {
  IdleDao: {
    [Network.MAINNET]: {
      fromBlock: 13244388,
      lendingGasCost: 328 * 1000,
      factoryAddress: '0x3c9916bb9498f637e2fa86c2028e26275dc9a631',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: '', index: 0 }],
    [SwapSide.BUY]: [{ name: '', index: 0 }],
  },
};

export const endpoints: Record<number, string> = {
  [Network.MAINNET]: 'https://api.idle.finance/pools',
  [Network.POLYGON]: 'https://api-polygon.idle.finance/pools',
  [Network.OPTIMISM]: 'https://api-optimism.idle.finance/pools',
  [Network.ZKEVM]: 'https://api-zkevm.idle.finance/pools',
};

export const AUTH_TOKEN_ENCODED =
  'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR2xsYm5SSlpDSTZJa0Z3Y0RZaUxDSnBZWFFpT2pFMk56QXlNemMxTWpkOS5rbnNtekVOSm40Yk5Ea0ZCM3h2eWZyaDBwVlFLTHY0NW9JanJQNHdRTU5N';
