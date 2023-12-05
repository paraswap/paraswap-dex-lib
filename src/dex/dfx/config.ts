import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import CurvepoolABI from '../../abi/dfx/Curve-pool.json';

export const DfxConfig: DexConfigMap<DexParams> = {
  Dfx: {
    [Network.MAINNET]: {
      poolConfigs: {
        'dfx-cadc-usdc-v3': {
          name: 'dfx-cadc-usdc-v3',
          address: '0x814A90726fb9f7cf7566e28Db634Ff5Fa959CeB1',
          coins: [
            {
              address: '0xcaDC0acd4B445166f12d2C07EAc6E2544FbE2Eef', // 0 - CADC
              decimals: 18,
            },
            {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // 1 - USDC
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x814A90726fb9f7cf7566e28Db634Ff5Fa959CeB1',
            decimals: 18,
          },
        },
      },
      abi: CurvepoolABI,
    },
    // [Network.POLYGON]: {},
    // [Network.ARBITRUM]: {},
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 9 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 9 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 6 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 2 }],
  },
};
