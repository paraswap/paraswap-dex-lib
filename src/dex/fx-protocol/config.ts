import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FxProtocolConfig: DexConfigMap<DexParams> = {
  FxProtocol: {
    [Network.MAINNET]: {
      fETH: '0x53805A76E1f5ebbFE7115F16f9c87C2f7e633726',
      xETH: '0xe063F04f280c60aECa68b38341C2eEcBeC703ae2',
      stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      market: '0xe7b9c7c9cA85340b8c06fb805f7775e3015108dB',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter02', index: 9 }],
  },
};
