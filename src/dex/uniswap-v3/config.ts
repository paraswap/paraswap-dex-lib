import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const SUPPORTED_FEES = [10000n, 3000n, 500n, 100n];

export const UniswapV3Config: DexConfigMap<DexParams> = {
  UniswapV3: {
    [Network.MAINNET]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedFees: SUPPORTED_FEES,
    },
    [Network.POLYGON]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedFees: SUPPORTED_FEES,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
