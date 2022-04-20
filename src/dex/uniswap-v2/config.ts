import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 4,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.ROPSTEN]: {
    [SwapSide.SELL]: [
      {
        name: 'RopstenAdapter01',
        index: 0,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'RopstenBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 4,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter01',
        index: 3,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BscBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'AvalancheBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'FantomBuyAdapter',
        index: 1,
      },
    ],
  },
};

export const UniswapV2Config: DexConfigMap<DexParams> = {
  UniswapV2: {
    [Network.MAINNET]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.ROPSTEN]: {
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  ApeSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://graph.apeswap.finance/subgraphs/name/ape-swap/apeswap-subgraph',
      factoryAddress: '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/apeswapfinance/dex-polygon',
      factoryAddress: '0xcf083be4164828f00cae704ec15a36d711491284',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  Baguette: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/baguette-exchange/baguette',
      factoryAddress: '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  BakerySwap: {
    [Network.BSC]: {
      subgraphURL: 'https://api.bscgraph.org/subgraphs/name/bakeryswap',
      factoryAddress: '0x01bF7C66c6BD861915CdaaE475042d3c4BaE16A7',
      feeCode: 30,
      router: '0x4B8107Bbdf7f7adF7B42a1C9cF14FAD8d32111C0',
      adapters: {
        [SwapSide.SELL]: [
          {
            name: 'BscAdapter01',
            index: 11,
          },
        ],
        [SwapSide.BUY]: null,
      },
    },
  },
  CanarySwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/canarydeveloper/canarydex',
      factoryAddress: '0xCFBA329d49C24b70F3a8b9CC0853493d4645436b',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  CheeseSwap: {
    [Network.BSC]: {
      factoryAddress: '0xdd538e4fd1b69b7863e1f741213276a6cf1efb3b',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  CoinSwap: {
    [Network.BSC]: {
      factoryAddress: '0xc2d8d27f3196d9989abf366230a47384010440c0',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  ComethSwap: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/cometh-game/comethswap',
      factoryAddress: '0x800b052609c355ca8103e06f022aa30647ead60a',
      feeCode: 50,
    },
  },
  ComplusSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/complusnetwork/subgraph-avae',
      factoryAddress: '0x5C02e78A3969D0E64aa2CFA765ACc1d671914aC0',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  DefiSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/crypto-com/swap-subgraph',
      factoryAddress: '0x9DEB29c9a4c7A88a3C0257393b7f3335338D9A9D',
      feeCode: 30,
    },
  },
  ElkFinance: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/elkfinance/elkdex-avax',
      factoryAddress: '0x091d35d7F63487909C863001ddCA481c6De47091',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  JulSwap: {
    [Network.BSC]: {
      // subgraphURL:
      //   'https://subgraph.swapliquidity.org/subgraphs/name/swapliquidity/subgraph',
      factoryAddress: '0x553990f2cba90272390f62c5bdb1681ffc899675',
      feeCode: 30,
    },
  },
  JetSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/smartcookie0501/jetswap-subgraph',
      factoryAddress: '0x0eb58e5c8aa63314ff5547289185cc4583dfcbd5',
      poolGasCost: 200 * 1000,
      feeCode: 30,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/smartcookie0501/jetswap-subgraph-polygon',
      factoryAddress: '0x668ad0ed2622c62e24f0d5ab6b6ac1b9d2cd4ac7',
      poolGasCost: 200 * 1000,
      feeCode: 10,
    },
  },
  KnightSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/shahzeb8285/dark-knight-two',
      factoryAddress: '0x7d82f56ea0820a9d42b01c3c28f1997721732218',
      feeCode: 20,
    },
  },
  LinkSwap: {
    [Network.MAINNET]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/yflink/linkswap-v1',
      factoryAddress: '0x696708Db871B77355d6C2bE7290B27CF0Bb9B24b',
      feeCode: 30,
    },
  },
  LydiaFinance: {
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/lydiacoder/lydia',
      factoryAddress: '0xe0C1bb6DF4851feEEdc3E14Bd509FEAF428f7655',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  Olive: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/olive-rose/olivecash',
      factoryAddress: '0x4Fe4D8b01A56706Bc6CaD26E8C59D0C7169976b3',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  Polycat: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/polycatfi/polycat-finance-amm',
      factoryAddress: '0x477Ce834Ae6b7aB003cCe4BC4d8697763FF456FA',
      poolGasCost: 100 * 1000,
      feeCode: 240,
    },
  },
  PantherSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://api.bscgraph.org/subgraphs/name/pantherswap/exchange',
      factoryAddress: '0x670f55c6284c629c23bae99f585e3f17e8b9fc31',
      feeCode: 20,
    },
  },
  PangolinSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/dasconnor/pangolin-dex',
      factoryAddress: '0xefa94DE7a4656D787667C749f7E1223D71E9FD88',
      poolGasCost: 89 * 1000,
      feeCode: 30,
    },
  },
  PancakeSwap: {
    [Network.BSC]: {
      factoryAddress: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  PancakeSwapV2: {
    [Network.BSC]: {
      subgraphURL:
        'https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2',
      factoryAddress: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
      poolGasCost: 90 * 1000,
      feeCode: 25,
    },
  },
  PaintSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/paint-swap-finance/exchange',
      factoryAddress: '0x733a9d1585f2d14c77b49d39bc7d7dd14cda4aa5',
      feeCode: 30,
    },
  },
  MorpheusSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/daedboi/morpheus-swap',
      factoryAddress: '0x9c454510848906fddc846607e4baa27ca999fbb6',
      feeCode: 15,
    },
  },
  SushiSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/croco-finance/sushiswap',
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      feeCode: 30,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange',
      factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      feeCode: 30,
    },
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushiswap/fantom-exchange',
      factoryAddress: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
      feeCode: 30,
    },
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
      factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      feeCode: 30,
    },
  },
  QuickSwap: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06',
      factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      feeCode: 30,
    },
  },
  RadioShack: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/radioshackcreator/radioshack-polygon',
      factoryAddress: '0xB581D0A3b7Ea5cDc029260e989f768Ae167Ef39B',
      feeCode: 10,
    },
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/radioshackcreator/radioshack-bsc',
      factoryAddress: '0x98957ab49b8bc9f7ddbCfD8BcC83728085ecb238',
      feeCode: 10,
    },
  },
  StreetSwap: {
    [Network.BSC]: {
      // subgraphURL:
      //   'https://subgraph.thugswap.vip/subgraphs/name/theothug/swap-subgraph',
      factoryAddress: '0xaC653cE27E04C6ac565FD87F18128aD33ca03Ba2',
      feeCode: 40,
    },
  },
  SpookySwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/eerieeight/spookyswap',
      factoryAddress: '0x152ee697f2e276fa89e96742e9bb9ab1f2e61be3',
      feeCode: 20,
    },
  },
  SpiritSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/layer3org/spiritswap-analytics',
      factoryAddress: '0xEF45d134b73241eDa7703fa787148D9C9F4950b0',
      feeCode: 30,
    },
  },
  ShibaSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/shibaswaparmy/exchange',
      factoryAddress: '0x115934131916C8b277DD010Ee02de363c09d037c',
      poolGasCost: 100 * 1000,
      feeCode: 30,
    },
  },
  SakeSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/therealsakeswap/sakeswap-subgraph-v2',
      factoryAddress: '0x75e48C954594d64ef9613AeEF97Ad85370F13807',
      poolGasCost: 100 * 1000,
      feeCode: 30,
    },
  },
  SafeSwap: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/yfdaifinance/safeswapmatic',
      factoryAddress: '0x5be44d6C5634161CdaDcC2bc35389325aa493e83',
      feeCode: 30,
    },
  },
  ZeroSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/winter256/zerobscgraph3',
      factoryAddress: '0x2Ef422F30cdb7c5F1f7267AB5CF567A88974b308',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  YetiSwap: {
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/yetiswap/yetiswap',
      factoryAddress: '0x58C8CD291Fa36130119E6dEb9E520fbb6AcA1c3a',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  WaultFinance: {
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/waultfinance/waultswap-bsc',
      factoryAddress: '0xB42E3FE71b7E0673335b3331B3e1053BD9822570',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/waultfinance/waultswap-polygon',
      factoryAddress: '0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  TraderJoe: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange',
      factoryAddress: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
      poolGasCost: 120 * 1000,
      feeCode: 30,
    },
  },
  Thorus: {
    [Network.AVALANCHE]: {
      factoryAddress: '0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef',
      poolGasCost: 120 * 1000,
      feeCode: 10,
    },
  },
};
