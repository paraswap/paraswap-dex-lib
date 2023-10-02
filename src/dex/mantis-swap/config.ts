import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MantisSwapConfig: DexConfigMap<DexParams> = {
  MantisSwap: {
    [Network.POLYGON]: {
      pools: [
        {
          address: '0x62Ba5e1AB1fa304687f132f67E35bFC5247166aD',
          name: 'Main Pool',
          tokenAddresses: [
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
          ],
        },
      ],
    },
    [Network.ZKEVM]: {
      pools: [
        {
          address: '0x12d41b6DF938C739F00c392575e3FD9292d98215',
          name: 'Main Pool',
          tokenAddresses: [
            '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035',
            '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
            '0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4',
          ],
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: '', index: 0 }],
  },
  [Network.ZKEVM]: {
    [SwapSide.SELL]: [{ name: '', index: 0 }],
  },
};
