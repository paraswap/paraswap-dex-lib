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
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'ArbitrumBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [
      {
        name: 'OptimismAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'OptimismBuyAdapter',
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
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.ROPSTEN]: {
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  ApeSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://graph.apeswap.finance/subgraphs/name/ape-swap/apeswap-subgraph',
      factoryAddress: '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6',
      initCode:
        '0xf4ccce374816856d11f00e4069e7cada164065686fbef53c6167a63ec2fd8c5b',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/apeswapfinance/dex-polygon',
      factoryAddress: '0xcf083be4164828f00cae704ec15a36d711491284',
      initCode:
        '0x511f0f358fe530cda0859ec20becf391718fdf5a329be02f4c95361f3d6a42d8',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  Baguette: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/baguette-exchange/baguette',
      factoryAddress: '0x3587b8c0136c2c3605a9e5b03ab54da3e4044b50',
      initCode:
        '0xf4ccce374816856d11f00e4069e7cada164065686fbef53c6167a63ec2fd8c5b',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  BakerySwap: {
    [Network.BSC]: {
      subgraphURL: 'https://api.bscgraph.org/subgraphs/name/bakeryswap',
      factoryAddress: '0x01bF7C66c6BD861915CdaaE475042d3c4BaE16A7',
      initCode:
        '0xe2e87433120e32c4738a7d8f3271f3d872cbe16241d67537139158d90bac61d3',
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
      initCode:
        '0x60df5edf580dff3274fff5a3d83ad2b6ef6e296f71c3bc28c939e641888bd5b0',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  CheeseSwap: {
    [Network.BSC]: {
      factoryAddress: '0xdd538e4fd1b69b7863e1f741213276a6cf1efb3b',
      initCode:
        '0xf52c5189a89e7ca2ef4f19f2798e3900fba7a316de7cef6c5a9446621ba86286',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  CoinSwap: {
    [Network.BSC]: {
      factoryAddress: '0xc2d8d27f3196d9989abf366230a47384010440c0',
      initCode:
        '0x2e3f108b8526ff1faa4d526bb84210fc5a2bfc5aad2f62207d7964554a5d029d',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  ComethSwap: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/cometh-game/comethswap',
      factoryAddress: '0x800b052609c355ca8103e06f022aa30647ead60a',
      initCode:
        '0x499154cad90a3563f914a25c3710ed01b9a43b8471a35ba8a66a056f37638542',
      feeCode: 50,
    },
  },
  ComplusSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/complusnetwork/subgraph-avae',
      factoryAddress: '0x5C02e78A3969D0E64aa2CFA765ACc1d671914aC0',
      initCode:
        '0x0f75b63316180834cae9ff38fbeb719026e1435e60ddb4509bd435f148feac97',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  DefiSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/crypto-com/swap-subgraph',
      factoryAddress: '0x9DEB29c9a4c7A88a3C0257393b7f3335338D9A9D',
      initCode:
        '0x69d637e77615df9f235f642acebbdad8963ef35c5523142078c9b8f9d0ceba7e',
      feeCode: 30,
    },
  },
  ElkFinance: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/elkfinance/elkdex-avax',
      factoryAddress: '0x091d35d7F63487909C863001ddCA481c6De47091',
      initCode:
        '0x33c4831a098654d3d20a78641a198ee6ffc1ceed49f2196b75bb244891c260e3',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  JulSwap: {
    [Network.BSC]: {
      // subgraphURL:
      //   'https://subgraph.swapliquidity.org/subgraphs/name/swapliquidity/subgraph',
      factoryAddress: '0x553990f2cba90272390f62c5bdb1681ffc899675',
      initCode:
        '0xb1e98e21a5335633815a8cfb3b580071c2e4561c50afd57a8746def9ed890b18',
      feeCode: 30,
    },
  },
  JetSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/smartcookie0501/jetswap-subgraph',
      factoryAddress: '0x0eb58e5c8aa63314ff5547289185cc4583dfcbd5',
      initCode:
        '0x3125d0a15fa7af49ce234ba1cf5f931bad0504242e0e1ee9fcd7d1d7aa88c651',
      poolGasCost: 200 * 1000,
      feeCode: 30,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/smartcookie0501/jetswap-subgraph-polygon',
      factoryAddress: '0x668ad0ed2622c62e24f0d5ab6b6ac1b9d2cd4ac7',
      initCode:
        '0x505c843b83f01afef714149e8b174427d552e1aca4834b4f9b4b525f426ff3c6',
      poolGasCost: 200 * 1000,
      feeCode: 10,
    },
  },
  KnightSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/shahzeb8285/dark-knight-two',
      factoryAddress: '0x7d82f56ea0820a9d42b01c3c28f1997721732218',
      initCode:
        '0x2e8dbc8cf79694a7ef827213d52da525b45ddf645a4abd477fcb4af09bfb5f0e',
      feeCode: 20,
    },
  },
  LinkSwap: {
    [Network.MAINNET]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/yflink/linkswap-v1',
      factoryAddress: '0x696708Db871B77355d6C2bE7290B27CF0Bb9B24b',
      initCode:
        '0x50955d9250740335afc702786778ebeae56a5225e4e18b7cb046e61437cde6b3',
      feeCode: 30,
    },
  },
  LydiaFinance: {
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/lydiacoder/lydia',
      factoryAddress: '0xe0C1bb6DF4851feEEdc3E14Bd509FEAF428f7655',
      initCode:
        '0x47cc4f3a5e7a237c464e09c6758ac645084f198b8f64eedc923317ac4481a10c',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  Olive: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/olive-rose/olivecash',
      factoryAddress: '0x4Fe4D8b01A56706Bc6CaD26E8C59D0C7169976b3',
      initCode:
        '0xb7145948956af92afd2ae97eff039ada60998237282c1687ca23ce1ad5e1d282',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  Polycat: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/polycatfi/polycat-finance-amm',
      factoryAddress: '0x477Ce834Ae6b7aB003cCe4BC4d8697763FF456FA',
      initCode:
        '0x3cad6f9e70e13835b4f07e5dd475f25a109450b22811d0437da51e66c161255a',
      poolGasCost: 100 * 1000,
      feeCode: 240,
    },
  },
  PantherSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://api.bscgraph.org/subgraphs/name/pantherswap/exchange',
      factoryAddress: '0x670f55c6284c629c23bae99f585e3f17e8b9fc31',
      initCode:
        '0x867d1354ae93986b4c49f35d8d7884f174264895ad8501d50d2cd365933d4aa5',
      feeCode: 20,
    },
  },
  PangolinSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/dasconnor/pangolin-dex',
      factoryAddress: '0xefa94DE7a4656D787667C749f7E1223D71E9FD88',
      initCode:
        '0x40231f6b438bce0797c9ada29b718a87ea0a5cea3fe9a771abdd76bd41a3e545',
      poolGasCost: 89 * 1000,
      feeCode: 30,
    },
  },
  PancakeSwap: {
    [Network.BSC]: {
      factoryAddress: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
      initCode:
        '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  PancakeSwapV2: {
    [Network.BSC]: {
      subgraphURL:
        'https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2',
      factoryAddress: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
      initCode:
        '0xa0e5696e64d8512d41c1887d32c208c1f427abd6a077148d760fc07ccbe12470',
      poolGasCost: 90 * 1000,
      feeCode: 25,
    },
  },
  PaintSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/paint-swap-finance/exchange',
      factoryAddress: '0x733a9d1585f2d14c77b49d39bc7d7dd14cda4aa5',
      initCode:
        '0x52178a9131f5551c2e56bf7cbf02aed8be8130e6493915a6b0c7602ac2125e54',
      feeCode: 30,
    },
  },
  MorpheusSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/daedboi/morpheus-swap',
      factoryAddress: '0x9c454510848906fddc846607e4baa27ca999fbb6',
      initCode:
        '0x82b04e3f5f54946a0ed70d459c25f54ad42d498268c75b27f9727e3d212e91fd',
      feeCode: 15,
    },
  },
  SushiSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/croco-finance/sushiswap',
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      initCode:
        '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
      feeCode: 30,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange',
      factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      initCode:
        '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
      feeCode: 30,
    },
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushiswap/fantom-exchange',
      factoryAddress: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
      initCode:
        '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
      feeCode: 30,
    },
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
      factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      initCode:
        '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
      feeCode: 30,
    },
    [Network.ARBITRUM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushiswap/arbitrum-exchange',
      factoryAddress: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      initCode:
        '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
      feeCode: 30,
    },
  },
  Swapsicle: {
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/billy93/exchange',
      factoryAddress: '0x9C60C867cE07a3c403E2598388673C10259EC768',
      initCode:
        '0x9e43ee37212e3296c7f6087d3e0a37b48a4e4e413538dac0fd18cfe2f80666c1',
      feeCode: 30,
    },
  },
  QuickSwap: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.fura.org/subgraphs/name/quickswap',
      factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      feeCode: 30,
    },
  },
  RadioShack: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/radioshackcreator/radioshack-polygon',
      factoryAddress: '0xB581D0A3b7Ea5cDc029260e989f768Ae167Ef39B',
      initCode:
        '0x3eef69365a159891ca18b545ccaf0d6aca9b22c988b8deb7a3e4fa2fc2418596',
      feeCode: 10,
    },
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/radioshackcreator/radioshack-bsc',
      factoryAddress: '0x98957ab49b8bc9f7ddbCfD8BcC83728085ecb238',
      initCode:
        '0x3eef69365a159891ca18b545ccaf0d6aca9b22c988b8deb7a3e4fa2fc2418596',
      feeCode: 10,
    },
  },
  StreetSwap: {
    [Network.BSC]: {
      // subgraphURL:
      //   'https://subgraph.thugswap.vip/subgraphs/name/theothug/swap-subgraph',
      factoryAddress: '0xaC653cE27E04C6ac565FD87F18128aD33ca03Ba2',
      initCode:
        '0x0b3961eeccfbf746d2d5c59ee3c8ae3a5dcf8dc9b0dfb6f89e1e8ca0b32b544b',
      feeCode: 40,
    },
  },
  SpookySwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/eerieeight/spookyswap',
      factoryAddress: '0x152ee697f2e276fa89e96742e9bb9ab1f2e61be3',
      initCode:
        '0xcdf2deca40a0bd56de8e3ce5c7df6727e5b1bf2ac96f283fa9c4b3e6b42ea9d2',
      feeCode: 20,
    },
  },
  SkullSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/chimpydev/skullswap',
      factoryAddress: '0x8362c94ea73D3E08A4b8525e5Dc209810B556E1f',
      initCode:
        '0x5ff334317f404502a86ecd557bb7b4912e76a92f7c6f8719af4c3fc70c0b5562',
      feeCode: 20,
    },
  },
  SpiritSwap: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/layer3org/spiritswap-analytics',
      factoryAddress: '0xEF45d134b73241eDa7703fa787148D9C9F4950b0',
      initCode:
        '0xe242e798f6cee26a9cb0bbf24653bf066e5356ffeac160907fe2cc108e238617',
      feeCode: 30,
    },
  },
  ShibaSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/shibaswaparmy/exchange',
      factoryAddress: '0x115934131916C8b277DD010Ee02de363c09d037c',
      initCode:
        '0x65d1a3b1e46c6e4f1be1ad5f99ef14dc488ae0549dc97db9b30afe2241ce1c7a',
      poolGasCost: 100 * 1000,
      feeCode: 30,
    },
  },
  SakeSwap: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/therealsakeswap/sakeswap-subgraph-v2',
      factoryAddress: '0x75e48C954594d64ef9613AeEF97Ad85370F13807',
      initCode:
        '0xb2b53dca60cae1d1f93f64d80703b888689f28b63c483459183f2f4271fa0308',
      poolGasCost: 100 * 1000,
      feeCode: 30,
    },
  },
  SafeSwap: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/yfdaifinance/safeswapmatic',
      factoryAddress: '0x5be44d6C5634161CdaDcC2bc35389325aa493e83',
      initCode:
        '0x58fc9539cd75d0d89841441f8663accbd9ad1135045be3b3d9028441eb1f20c4',
      feeCode: 30,
    },
  },
  ZeroSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/winter256/zerobscgraph3',
      factoryAddress: '0x2Ef422F30cdb7c5F1f7267AB5CF567A88974b308',
      initCode:
        '0x4b5b254233f8aba1e01c0538653d54036e3c9f7873daf99623bb358f1cf33188',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  YetiSwap: {
    [Network.AVALANCHE]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/yetiswap/yetiswap',
      factoryAddress: '0x58C8CD291Fa36130119E6dEb9E520fbb6AcA1c3a',
      initCode:
        '0xcc133f6dd9577d2022e9f47ec90dd24049584e73131095c170715fa7c950a64a',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  WaultFinance: {
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/waultfinance/waultswap-bsc',
      factoryAddress: '0xB42E3FE71b7E0673335b3331B3e1053BD9822570',
      initCode:
        '0x9599db1eaa37ab366bf260f51beefce9296eb6197de387c533d905e9b82debe9',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/waultfinance/waultswap-polygon',
      factoryAddress: '0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef',
      initCode:
        '0x1cdc2246d318ab84d8bc7ae2a3d81c235f3db4e113f4c6fdc1e2211a9291be47',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  TraderJoe: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange',
      factoryAddress: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
      initCode:
        '0x0bbca9af0511ad1a1da383135cf3a8d2ac620e549ef9f6ae3a4c33c2fed0af91',
      poolGasCost: 120 * 1000,
      feeCode: 30,
    },
  },
  Thorus: {
    [Network.AVALANCHE]: {
      factoryAddress: '0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef',
      initCode:
        '0xc6b4cc64699496d0514c783d6aca5142c3b61e327524db01cabfa4248e430e49',
      poolGasCost: 120 * 1000,
      feeCode: 10,
    },
  },
  ZipSwap: {
    [Network.OPTIMISM]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/nonamefits/zipswap',
      factoryAddress: '0x8BCeDD62DD46F1A76F8A1633d4f5B76e0CDa521E',
      initCode:
        '0x1a76b7e7272f6187014e23f04d1b2e543eed2fd1f76481149008cc6eacb05c22',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
};
