import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SynthetixConfig: DexConfigMap<DexParams> = {
  Synthetix: {
    [Network.MAINNET]: {
      readProxyAddressResolver: '0x4E3b31eB0E5CB73641EE1E65E7dCEFe520bA3ef2',
    },
    [Network.OPTIMISM]: {
      readProxyAddressResolver: '0x1Cb059b7e74fD21665968C908806143E744D5F30',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
