import { AdapterMappings, DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from 'paraswap-core';

export const threePoolName = 'ThreePool';

export const NerveConfig: DexConfigMap<DexParams> = {
  Nerve: {
    [Network.BSC]: {
      poolConfigs: {
        [threePoolName]: {
          name: threePoolName,
          address: '0x1B3771a66ee31180906972580adE9b81AFc5fCDc',
          coins: [
            {
              address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 0 - BUSD
              decimals: 18,
            },
            {
              address: '0x55d398326f99059fF775485246999027B3197955', // 1 - USDT
              decimals: 18,
            },
            {
              address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 2 - USDC
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xf2511b5E4FB0e5E2d123004b672BA14850478C14',
            decimals: 18,
          },
        },
        BTC: {
          name: 'BTC',
          address: '0x6C341938bB75dDe823FAAfe7f446925c66E6270c',
          coins: [
            {
              address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // 0 - bBTC
              decimals: 18,
            },
            {
              address: '0x54261774905f3e6E9718f2ABb10ed6555cae308a', // 1 - anyBTC
              decimals: 8,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0xD1D5Af92C606C6F2eC59D453f57A6FCc188D7dB5',
            decimals: 18,
          },
        },
        ETH: {
          name: 'ETH',
          address: '0x146CD24dCc9f4EB224DFd010c5Bf2b0D25aFA9C0',
          coins: [
            {
              address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // 0 - bETH
              decimals: 18,
            },
            {
              address: '0x6F817a0cE8F7640Add3bC0c1C2298635043c2423', // 1 - anyETH
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0x0d283BF16A9bdE49cfC48d8dc050AF28b71bdD90',
            decimals: 18,
          },
        },
        // fUSDT: {
        //   name: 'fUSDT',
        //   address: '0xd0fBF0A224563D5fFc8A57e4fdA6Ae080EbCf3D3',
        //   coins: [
        //     '0x049d68029688eAbF473097a2fC38ef61633A3C7A', // 0 - fUSDT
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x2e91A0CECf28c5E518bB2E7fdcd9F8e2cd511c10',
        // },
        // UST: {
        //   name: 'UST',
        //   address: '0x2dcCe1586b1664f41C72206900e404Ec3cA130e0',
        //   coins: [
        //     '0x23396cF899Ca06c4472205fC903bDB4de249D6fC', // 0 - wUST
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x35Ce243e0DC9eD77e3C348Bb2742095F78e1Cb70',
        // },
        // rUSD: {
        //   name: 'rUSD',
        //   address: '0x0eafaa7ed9866c1f08ac21dd0ef3395e910f7114',
        //   coins: [
        //     '0x07663837218A003e66310a01596af4bf4e44623D', // 0 - rUSD
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x870ee4d19c12A789c61de69E3E5eFb42383E4434',
        // },
      },
    },
  },

  Axial: {
    [Network.AVALANCHE]: {
      poolConfigs: {
        AS4D: {
          name: 'AS4D',
          address: '0x2a716c4933A20Cd8B9f9D9C39Ae7196A85c24228',
          coins: [
            {
              address: '0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB', // 0 - TUSD
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 1 - USDC.e
              decimals: 6,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 2 - DAI.e
              decimals: 18,
            },
            {
              address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // 3 - USDT.e
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x3a7387f8ba3ebffa4a0eccb1733e940ce2275d3f',
            decimals: 18,
          },
        },
        AC4D: {
          name: 'AC4D',
          address: '0x8c3c1C6F971C01481150CA7942bD2bbB9Bc27bC7',
          coins: [
            {
              address: '0x4fbf0429599460D327BD5F55625E30E4fC066095', // 0 - TSD
              decimals: 18,
            },
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 1 - MIM
              decimals: 18,
            },
            {
              address: '0xD24C2Ad096400B6FBcd2ad8B24E7acBc21A1da64', // 2 - FRAX
              decimals: 18,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 3 - DAI.e
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x4da067E13974A4d32D342d86fBBbE4fb0f95f382',
            decimals: 18,
          },
        },
        AM3D: {
          name: 'AM3D',
          address: '0x90c7b96AD2142166D001B27b5fbc128494CDfBc8',
          coins: [
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 0 - MIM
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 1 - USDC.e
              decimals: 6,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 2 - DAI.e
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xc161E4B11FaF62584EFCD2100cCB461A2DdE64D1',
            decimals: 18,
          },
        },
        AA3D: {
          name: 'AA3D',
          address: '0x6EfbC734D91b229BE29137cf9fE531C1D3bf4Da6',
          coins: [
            {
              address: '0x346A59146b9b4a77100D369a3d18E8007A9F46a6', // 0 - AVAI
              decimals: 18,
            },
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 1 - MIM
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 2 - USDC.e
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xaD556e7dc377d9089C6564f9E8d275f5EE4da22d',
            decimals: 18,
          },
        },
      },
    },
  },
  IronV2: {
    [Network.AVALANCHE]: { poolConfigs: {} },
  },
  Saddle: {
    [Network.AVALANCHE]: { poolConfigs: {} },
  },
  Snowball: {
    [Network.AVALANCHE]: { poolConfigs: {} },
  },
};

export const NERVE_CHUNKS = 10;
export const NERVE_GAS_COST = 200 * 1000;

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 4 }],
  },
};
