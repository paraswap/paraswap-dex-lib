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
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 0 - BUSD
            '0x55d398326f99059fF775485246999027B3197955', // 1 - USDT
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 2 - USDC
          ],
          isMetapool: false,
          lpTokenAddress: '0xf2511b5E4FB0e5E2d123004b672BA14850478C14',
          trackCoins: false,
        },
        BTC: {
          name: 'BTC',
          address: '0x6C341938bB75dDe823FAAfe7f446925c66E6270c',
          coins: [
            '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // 0 - bBTC
            '0x54261774905f3e6E9718f2ABb10ed6555cae308a', // 1 - anyBTC
          ],
          isMetapool: false,
          lpTokenAddress: '0xD1D5Af92C606C6F2eC59D453f57A6FCc188D7dB5',
          trackCoins: false,
        },
        ETH: {
          name: 'ETH',
          address: '0x146CD24dCc9f4EB224DFd010c5Bf2b0D25aFA9C0',
          coins: [
            '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // 0 - bETH
            '0x6F817a0cE8F7640Add3bC0c1C2298635043c2423', // 1 - anyETH
          ],
          isMetapool: false,
          lpTokenAddress: '0x0d283BF16A9bdE49cfC48d8dc050AF28b71bdD90',
          trackCoins: false,
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
        //   trackCoins: false,
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
        //   trackCoins: false,
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
        //   trackCoins: false,
        // },
      },
    },
  },
};

export const NERVE_CHUNKS = 10;

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 4 }],
  },
};
