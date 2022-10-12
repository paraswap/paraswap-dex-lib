import { SwapSide } from 'paraswap-core';
import { Network } from '../../../../constants';
import { AdapterMappings, DexConfigMap } from '../../../../types';
import { DexParams } from '../../types';

export const CurveForksConfig: DexConfigMap<DexParams> = {
  Acryptos: {
    [Network.BSC]: {
      baseTokens: {
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56': {
          address: '0xe9e7CEA3DedcA598478Bafc599bD69ADd087D56',
          decimals: 18,
          reasonableVolume: 1000000000000000000n,
        },
      },
      factoryAddress: null,
      eventSupportedPools: ['0xb3F0C9ea1F05e312093Fdb031E789A756659B0AC'],
      pools: {
        ACS4USD: {
          underlying: [],
          coins: [
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            '0x55d398326f99059fF775485246999027B3197955',
            '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          ],
          precisionMul: ['1', '1', '1', '1'],
          address: '0xb3F0C9ea1F05e312093Fdb031E789A756659B0AC',
          tokenAddress: '0x83D69Ef5c9837E21E2389D47d791714F5771F29b',
          name: 'ACS4USD',
          type: 1,
          version: 3,
          isLending: false,
          trackCoins: false,
          useLending: [false, false, false, false],
          isMetapool: false,
          baseToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        },
        ACS4VAI: {
          underlying: [
            '0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7',
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            '0x55d398326f99059fF775485246999027B3197955',
            '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          ],
          coins: [
            '0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7',
            '0x83d69ef5c9837e21e2389d47d791714f5771f29b',
          ],
          precisionMul: ['1', '1'],
          address: '0x191409D5A4EfFe25b0f4240557BA2192D18a191e',
          tokenAddress: '0xEb7Dc7b3bfF60A450EfF31Edf1330355361EA5ad',
          name: 'ACS4VAI',
          type: 2,
          version: 3,
          isLending: false,
          isMetapool: true,
          trackCoins: true,
          useLending: [false, false],
          baseToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        },
        ACS4QUSD: {
          underlying: [
            '0xb8C540d00dd0Bf76ea12E4B4B95eFC90804f924E',
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            '0x55d398326f99059fF775485246999027B3197955',
            '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          ],
          coins: [
            '0xb8C540d00dd0Bf76ea12E4B4B95eFC90804f924E',
            '0x83d69ef5c9837e21e2389d47d791714f5771f29b',
          ],
          precisionMul: ['1', '1'],
          address: '0x3919874C7bc0699cF59c981C5eb668823FA4f958',
          tokenAddress: '0x49440376254290b3264183807A16450457f02B28',
          name: 'ACS4QUSD',
          type: 2,
          version: 3,
          isLending: false,
          isMetapool: true,
          trackCoins: true,
          useLending: [false, false],
          baseToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        },
        ACS4QUST: {
          underlying: [
            '0x23396cF899Ca06c4472205fC903bDB4de249D6fC',
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            '0x55d398326f99059fF775485246999027B3197955',
            '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          ],
          coins: [
            '0x23396cF899Ca06c4472205fC903bDB4de249D6fC',
            '0x83d69ef5c9837e21e2389d47d791714f5771f29b',
          ],
          precisionMul: ['1', '1'],
          address: '0x99c92765EfC472a9709Ced86310D64C4573c4b77',
          tokenAddress: '0xD3DEBe4a971e4492d0D61aB145468A5B2c23301b',
          name: 'ACS4QUSD',
          type: 2,
          version: 3,
          isLending: false,
          isMetapool: true,
          trackCoins: true,
          useLending: [false, false],
          baseToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        },
      },
    },
  },
  Ellipsis: {
    [Network.BSC]: {
      baseTokens: {
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56': {
          address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
          decimals: 18,
          reasonableVolume: 1000000000000000000n,
        },
      },
      factoryAddress: null,
      eventSupportedPools: ['0x160CAed03795365F3A589f10C379FfA7d75d4E76'],
      pools: {
        StableSwapEllipsis: {
          underlying: [],
          coins: [
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            '0x55d398326f99059fF775485246999027B3197955',
          ],
          address: '0x160CAed03795365F3A589f10C379FfA7d75d4E76',
          name: 'StableSwapEllipsis',
          type: 1,
          version: 3,
          isLending: false,
          precisionMul: ['1', '1', '1'],
          tokenAddress: '0xaF4dE8E872131AE328Ce21D909C74705d3Aaf452',
          trackCoins: true,
          isMetapool: false,
          useLending: [false, false, false],
          baseToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        },
        BUSD_axlUSD: {
          underlying: [],
          coins: [
            // axlUSD
            '0x4268B8F0B87b6Eae5d897996E6b845ddbD99Adf3',
            // BUSD
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
          ],
          address: '0x6731D8ce7C52FEc9136cf3b7d122C032C46fF58f',
          name: 'BUSD_axlUSD',
          type: 1,
          version: 3,
          isLending: false,
          precisionMul: ['1000000000000', '1'],
          tokenAddress: '0x7076402a3c267270fD0A45861A3ab66883f472c3',
          trackCoins: true,
          isMetapool: false,
          useLending: [false, false],
          baseToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter01',
        index: 2,
      },
    ],
  },
};
