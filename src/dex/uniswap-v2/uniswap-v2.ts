import { AbiCoder, Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import erc20ABI from '../../abi/erc20.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import {
  AdapterExchangeParam,
  Address,
  DexConfigMap,
  ExchangePrices,
  Log,
  Logger,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
  TxInfo,
} from '../../types';
import {
  DexParams,
  UniswapData,
  UniswapDataLegacy,
  UniswapParam,
  UniswapPool,
  UniswapV2Data,
  UniswapV2Functions,
} from './types';
import { IDex } from '../../dex/idex';
import {
  ETHER_ADDRESS,
  MAX_UINT,
  Network,
  NULL_ADDRESS,
} from '../../constants';
import { SimpleExchange } from '../simple-exchange';
import { NumberAsString, SwapSide } from 'paraswap-core';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  wrapETH,
  getDexKeysWithNetwork,
  isETHAddress,
  prependWithOx,
} from '../../utils';
import uniswapV2ABI from '../../abi/uniswap-v2/uniswapv2.abi.json';
import uniswapV2factoryABI from '../../abi/uniswap-v2/uniswap-v2-factory.abi.json';
import { Contract } from '@ethersproject/contracts';
import { WETHAddresses } from '../weth';

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
      subgraphURL: '',
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
  BaguetteSwap: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/baguette-exchange/baguette',
      factoryAddress: '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6',
      initCode:
        '0xf4ccce374816856d11f00e4069e7cada164065686fbef53c6167a63ec2fd8c5b',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
  BakerySwap: {
    // TODO: BakerySwapExchangeRouter 0x4B8107Bbdf7f7adF7B42a1C9cF14FAD8d32111C0
    [Network.BSC]: {
      subgraphURL: 'https://api.bscgraph.org/subgraphs/name/bakeryswap',
      factoryAddress: '0x01bF7C66c6BD861915CdaaE475042d3c4BaE16A7',
      initCode:
        '0xe2e87433120e32c4738a7d8f3271f3d872cbe16241d67537139158d90bac61d3',
      feeCode: 30,
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
  ChesseSwap: {
    [Network.BSC]: {
      subgraphURL: '', // TODO
      factoryAddress: '0xdd538e4fd1b69b7863e1f741213276a6cf1efb3b',
      initCode:
        '0xf52c5189a89e7ca2ef4f19f2798e3900fba7a316de7cef6c5a9446621ba86286',
      poolGasCost: 100 * 1000,
      feeCode: 20,
    },
  },
  CoinSwap: {
    [Network.BSC]: {
      subgraphURL: '', // TODO
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
  Dfyn: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/ss-sonic/dfyn-v4',
      factoryAddress: '0xE7Fb3e833eFE5F9c441105EB65Ef8b261266423B',
      initCode:
        '0xf187ed688403aa4f7acfada758d8d53698753b998a3071b06f1b777f4330eaf3',
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
      subgraphURL:
        'https://subgraph.swapliquidity.org/subgraphs/name/swapliquidity/subgraph',
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
  MDEX: {
    [Network.BSC]: {
      subgraphURL: '', // TODO
      factoryAddress: '0x3cd1c46068daea5ebb0d3f55f6915b10648062b8',
      initCode:
        '0x0d994d996174b05cfc7bed897dc1b20b4c458fc8d64fe98bc78b3c64a6b4d093',
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
    // TODO: check subgraph
    [Network.BSC]: {
      subgraphURL:
        'https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2',
      factoryAddress: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
      initCode:
        '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66',
      poolGasCost: 80 * 1000,
      feeCode: 20,
    },
  },
  PancakeSwapV2: {
    // TODO: check subgraph
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
  },
  QuickSwap: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06',
      factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      feeCode: 30,
    },
  },
  StreetSwap: {
    [Network.BSC]: {
      subgraphURL:
        'https://subgraph.thugswap.vip/subgraphs/name/theothug/swap-subgraph',
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
      subgraphURL: '', // TODO
      factoryAddress: '0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef',
      initCode:
        '0xc6b4cc64699496d0514c783d6aca5142c3b61e327524db01cabfa4248e430e49',
      poolGasCost: 120 * 1000,
      feeCode: 10,
    },
  },
};

const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.BUY]: [
      {
        name: 'Adapter01',
        index: 4,
      },
    ],
  },
  [Network.ROPSTEN]: {
    [SwapSide.BUY]: [
      {
        name: 'RopstenAdapter01',
        index: 0,
      },
    ],
  },
};

const MAX_UINT_BIGINT = BigInt(MAX_UINT);
const RESERVE_LIMIT = BigInt(2) ** BigInt(112) - BigInt(1);

const DefaultUniswapV2PoolGasGost = 90 * 1000;

interface UniswapV2PoolOrderedParams {
  tokenIn: string;
  tokenOut: string;
  reservesIn: string;
  reservesOut: string;
  fee: string;
  direction: boolean;
  exchange: string;
}

interface UniswapV2PoolState {
  reserves0: string;
  reserves1: string;
}

const iface = new Interface(uniswapV2ABI);
const erc20iface = new Interface(erc20ABI);
const coder = new AbiCoder();

export const directUniswapFunctionName = [
  UniswapV2Functions.swapOnUniswap,
  UniswapV2Functions.buyOnUniswap,
  UniswapV2Functions.swapOnUniswapFork,
  UniswapV2Functions.buyOnUniswapFork,
  UniswapV2Functions.swapOnUniswapV2Fork,
  UniswapV2Functions.buyOnUniswapV2Fork,
];

export type UniswapV2Pair = {
  token0: Token;
  token1: Token;
  exchange?: Address;
  pool?: UniswapV2EventPool;
};

export class UniswapV2EventPool extends StatefulEventSubscriber<UniswapV2PoolState> {
  decoder = (log: Log) => iface.parseLog(log);

  constructor(
    protected parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private token0: Token,
    private token1: Token,
    logger: Logger,
  ) {
    super(
      parentName +
        ' ' +
        (token0.symbol || token0.address) +
        '-' +
        (token1.symbol || token1.address) +
        ' pool',
      logger,
    );
  }

  protected processLog(
    state: DeepReadonly<UniswapV2PoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<UniswapV2PoolState> | null> {
    const event = this.decoder(log);
    switch (event.name) {
      case 'Sync':
        return {
          reserves0: event.args.reserve0.toString(),
          reserves1: event.args.reserve1.toString(),
        };
    }
    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<UniswapV2PoolState>> {
    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.callStatic.aggregate(
        [
          {
            target: this.token0.address,
            callData: erc20iface.encodeFunctionData('balanceOf', [
              this.poolAddress,
            ]),
          },
          {
            target: this.token1.address,
            callData: erc20iface.encodeFunctionData('balanceOf', [
              this.poolAddress,
            ]),
          },
        ],
        {
          blockTag: blockNumber,
        },
      );

    const reserves = data.returnData.map(r =>
      coder.decode(['uint256'], r)[0].toString(),
    );
    return {
      reserves0: reserves[0],
      reserves1: reserves[1],
    };
  }
}

export const UniswapV2ExchangeRouter: { [network: number]: Address } = {
  137: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  1: '0xF9234CB08edb93c0d4a4d4c70cC3FfD070e78e07',
  3: '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  56: '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  43114: '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  250: '0xAB86e2bC9ec5485a9b60E684BA6d49bf4686ACC2',
};

// Apply extra fee for certain tokens when used as input to swap (basis points)
// These could be tokens with fee on transfer or rounding error on balances
// Token addresses must be in lower case!
export const TOKEN_EXTRA_FEE: { [tokenAddress: string]: number } = {
  // stETH - uses balances based on shares which causes rounding errors
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 1,
};

function encodePools(pools: UniswapPool[]): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(10000 - fee) << BigInt(161)) +
      (BigInt(direction ? 0 : 1) << BigInt(160)) +
      BigInt(address)
    ).toString();
  });
}

export class UniswapV2
  extends SimpleExchange
  implements IDex<UniswapV2Data, UniswapParam>
{
  pairs: { [key: string]: UniswapV2Pair } = {};
  feeFactor = 10000;
  factory: Contract;

  routerInterface: Interface;
  exchangeRouterInterface: Interface;
  static directFunctionName = directUniswapFunctionName;

  logger: Logger;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UniswapV2Config);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected factoryAddress: Address = UniswapV2Config[dexKey][network]
      .factoryAddress,
    protected subgraphURL: string = UniswapV2Config[dexKey][network]
      .subgraphURL,
    protected initCode: string = UniswapV2Config[dexKey][network].initCode,
    protected feeCode: number = UniswapV2Config[dexKey][network].feeCode,
    protected poolGasCost: number = UniswapV2Config[dexKey][network]
      .poolGasCost ?? DefaultUniswapV2PoolGasGost,
    protected adapters = Adapters[network],
    protected router = UniswapV2ExchangeRouter[network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);

    this.factory = new Contract(
      factoryAddress,
      uniswapV2factoryABI,
      dexHelper.provider,
    );
  }

  private async addPool(
    pair: UniswapV2Pair,
    reserves0: string,
    reserves1: string,
    blockNumber: number,
  ) {
    pair.pool = new UniswapV2EventPool(
      this.dexKey,
      this.dexHelper,
      pair.address,
      pair.token0,
      pair.token1,
      this.logger,
    );

    if (blockNumber) pair.pool.setState({ reserves0, reserves1 }, blockNumber);
    this.dexHelper.blockManager.subscribeToLogs(
      pair.pool,
      pair.exchange!,
      blockNumber,
    );
  }

  async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut, fee } = priceParams;

    const numerator = BigInt(reservesIn) * destAmount * BigInt(this.feeFactor);
    const denominator =
      (BigInt(this.feeFactor) - BigInt(fee)) *
      (BigInt(reservesOut) - destAmount);

    if (denominator <= BigInt(0)) return MAX_UINT_BIGINT;
    return BigInt(1) + numerator / denominator;
  }

  async getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut, fee } = priceParams;

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return BigInt(0);
    }

    const amountInWithFee = srcAmount * BigInt(this.feeFactor - parseInt(fee));

    const numerator = amountInWithFee * BigInt(reservesOut);

    const denominator =
      BigInt(reservesIn) * BigInt(this.feeFactor) + amountInWithFee;

    return denominator === BigInt(0) ? BigInt(0) : numerator / denominator;
  }

  async getBuyPricePath(
    amount: bigint,
    params: UniswapV2PoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params.reverse()) {
      price = await this.getBuyPrice(param, price);
    }
    return price;
  }

  async getSellPricePath(
    amount: bigint,
    params: UniswapV2PoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params) {
      price = await this.getSellPrice(param, price);
    }
    return price;
  }

  private async findPair(from: Token, to: Token) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`;
    let pair = this.pairs[key];
    if (pair) return pair;
    const exchange = await this.factory.methods
      .getPair(token0.address, token1.address)
      .call();
    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }
    this.pairs[key] = pair;
    return pair;
  }

  async getManyPoolReserves(
    pairs: UniswapV2Pair[],
    blockNumber: number,
  ): Promise<UniswapV2PoolState[]> {
    try {
      const calldata = pairs
        .map(pair => [
          {
            target: pair.token0.address,
            callData: erc20iface.encodeFunctionData('balanceOf', [
              pair.exchange!,
            ]),
          },
          {
            target: pair.token1.address,
            callData: erc20iface.encodeFunctionData('balanceOf', [
              pair.exchange!,
            ]),
          },
        ])
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.callStatic.aggregate(calldata, {
          blockTag: blockNumber,
        });

      const reserves = _.chunk(
        data.returnData.map(
          r => <string>coder.decode(['uint256'], r)[0].toString(),
        ),
        2,
      );
      return reserves.map(pair => ({
        reserves0: pair[0],
        reserves1: pair[1],
      }));
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  async batchCatchUpPairs(pairs: [Token, Token][], blockNumber: number) {
    if (!blockNumber) return;
    const pairsToFetch: UniswapV2Pair[] = [];
    for (const _pair of pairs) {
      const pair = await this.findPair(_pair[0], _pair[1]);
      if (!(pair && pair.exchange)) continue;
      if (!pair.pool) {
        pairsToFetch.push(pair);
      } else if (!pair.pool.getState(blockNumber)) {
        pairsToFetch.push(pair);
      }
    }

    if (!pairsToFetch.length) return;

    const reserves = await this.getManyPoolReserves(pairsToFetch, blockNumber);

    if (reserves.length !== pairsToFetch.length) {
      this.logger.error(
        `Error_getManyPoolReserves didn't get any pool reserves`,
      );
    }

    for (let i = 0; i < pairsToFetch.length; i++) {
      const pairState = reserves[i];
      const pair = pairsToFetch[i];
      if (!pair.pool) {
        await this.addPool(
          pair,
          pairState.reserves0,
          pairState.reserves1,
          blockNumber,
        );
      } else pair.pool.setState(pairState, blockNumber);
    }
  }

  async getPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
  ): Promise<UniswapV2PoolOrderedParams | null> {
    const pair = await this.findPair(from, to);
    if (!(pair && pair.pool && pair.exchange)) return null;
    const pairState = pair.pool.getState(blockNumber);
    if (!pairState) {
      this.logger.error(
        `Error_orderPairParams expected reserves, got none (maybe the pool doesn't exist) ${
          from.symbol || from.address
        } ${to.symbol || to.address}`,
      );
      return null;
    }
    const fee = (
      this.feeCode + (TOKEN_EXTRA_FEE[from.address.toLowerCase()] || 0)
    ).toString();
    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();
    if (pairReversed) {
      return {
        tokenIn: from.address,
        tokenOut: to.address,
        reservesIn: pairState.reserves1,
        reservesOut: pairState.reserves0,
        fee,
        direction: false,
        exchange: pair.exchange,
      };
    }
    return {
      tokenIn: from.address,
      tokenOut: to.address,
      reservesIn: pairState.reserves0,
      reservesOut: pairState.reserves1,
      fee,
      direction: true,
      exchange: pair.exchange,
    };
  }

  async getPoolIdentifiers(
    _from: Token,
    _to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = wrapETH(_from, this.network);
    const to = wrapETH(_to, this.network);

    const tokenAdderess = [from.address.toLowerCase(), to.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAdderess}`;
    return [poolIdentifier];
  }

  async getPricesVolume(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    // list of pool identifiers to use for pricing, if undefined use all pools
    limitPools?: string[],
  ): Promise<ExchangePrices<UniswapV2Data> | null> {
    try {
      const from = wrapETH(_from, this.network);
      const to = wrapETH(_to, this.network);

      const tokenAdderess = [
        from.address.toLowerCase(),
        to.address.toLowerCase(),
      ]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_');

      const poolIdentifier = `${this.dexKey}_${tokenAdderess}`;

      if (limitPools.length !== 1 || limitPools[0] !== poolIdentifier)
        return null;

      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      await this.batchCatchUpPairs([[from, to]], blockNumber);

      const pairParam = await this.getPairOrderedParams(from, to, blockNumber);

      if (!pairParam) return null;

      const unitAmount =
        BigInt(1) *
        BigInt(10 ** (side == SwapSide.BUY ? to.decimals : from.decimals));
      const unit =
        side == SwapSide.BUY
          ? await this.getBuyPricePath(unitAmount, [pairParam])
          : await this.getSellPricePath(unitAmount, [pairParam]);

      const prices =
        side == SwapSide.BUY
          ? await Promise.all(
              amounts.map(amount => this.getBuyPricePath(amount, [pairParam])),
            )
          : await Promise.all(
              amounts.map(amount => this.getSellPricePath(amount, [pairParam])),
            );

      // As uniswapv2 just has one pool per token pair
      return [
        {
          prices: prices,
          unit: unit,
          data: {
            router: this.router,
            path: [from.address.toLowerCase(), to.address.toLowerCase()],
            factory: this.factoryAddress,
            initCode: this.initCode,
            feeFactor: this.feeFactor,
            pools: [
              {
                address: pairParam.exchange,
                fee: parseInt(pairParam.fee),
                direction: pairParam.direction,
              },
            ],
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: this.poolGasCost,
          poolAddresses: [pairParam.exchange],
        },
      ];
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] {
    return this.adapters[side];
  }

  async getTopPoolsForToken(
    token: Token,
    count: number,
  ): Promise<PoolLiquidity[]> {
    const query = `
      query ($token: Bytes!, $count: Int) {
        pools0: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token0: $token, reserve0_gt: 1, reserve1_gt: 1}) {
        id
        token0 {
          id
          decimals
        }
        token1 {
          id
          decimals
        }
        reserveUSD
      }
      pools1: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token1: $token, reserve0_gt: 1, reserve1_gt: 1}) {
        id
        token0 {
          id
          decimals
        }
        token1 {
          id
          decimals
        }
        reserveUSD
      }
    }`;

    const { data } = await this.dexHelper.httpRequest.post(this.subgraphURL, {
      query,
      variables: { token, count },
    });

    if (!(data && data.pools0 && data.pools1))
      throw new Error("Couldn't fetch the pools from the subgraph");
    const pools0 = _.map(data.pools0, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token1.id.toLowerCase(),
          decimals: parseInt(pool.token1.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    const pools1 = _.map(data.pools1, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token0.id.toLowerCase(),
          decimals: parseInt(pool.token0.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    const pools = _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      count,
    );

    return pools;
  }

  protected fixPath(path: Address[], srcToken: Address, destToken: Address) {
    return path.map((token: string, i: number) => {
      if (
        (i === 0 && srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase()) ||
        (i === path.length - 1 &&
          destToken.toLowerCase() === ETHER_ADDRESS.toLowerCase())
      )
        return ETHER_ADDRESS;
      return token;
    });
  }

  getWETHAddress(srcToken: Address, destToken: Address, weth?: Address) {
    if (!isETHAddress(srcToken) && !isETHAddress(destToken))
      return NULL_ADDRESS;
    return weth || WETHAddresses[this.network];
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: UniswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const pools = encodePools(data.pools);
    const weth = this.getWETHAddress(srcToken, destToken, data.weth);
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          weth: 'address',
          pools: 'uint256[]',
        },
      },
      { pools, weth },
    );
    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const pools = encodePools(data.pools);
    const weth = this.getWETHAddress(src, dest, data.weth);
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      side === SwapSide.SELL ? UniswapV2Functions.swap : UniswapV2Functions.buy,
      [src, srcAmount, destAmount, weth, pools],
    );
    return this.buildSimpleParamWithoutWETHConversion(
      src,
      srcAmount,
      dest,
      destAmount,
      swapData,
      data.router,
    );
  }

  // TODO: Move to new uniswapv2&forks router interface
  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    _data: UniswapData,
    side: SwapSide,
    contractMethod?: string,
  ): TxInfo<UniswapParam> {
    if (!contractMethod) throw new Error(`contractMethod need to be passed`);

    const swapParams = ((): UniswapParam => {
      const data = _data as unknown as UniswapDataLegacy;
      const path = this.fixPath(data.path, srcToken, destToken);

      switch (contractMethod) {
        case UniswapV2Functions.swapOnUniswap:
        case UniswapV2Functions.buyOnUniswap:
          return [srcAmount, destAmount, path];

        case UniswapV2Functions.swapOnUniswapFork:
        case UniswapV2Functions.buyOnUniswapFork:
          return [
            data.factory,
            prependWithOx(data.initCode),
            srcAmount,
            destAmount,
            path,
          ];

        case UniswapV2Functions.swapOnUniswapV2Fork:
        case UniswapV2Functions.buyOnUniswapV2Fork:
          return [
            srcToken,
            srcAmount,
            destAmount,
            this.getWETHAddress(srcToken, destToken, _data.weth),
            encodePools(_data.pools),
          ];

        default:
          throw new Error(`contractMethod=${contractMethod} is not supported`);
      }
    })();

    const encoder = (...params: UniswapParam) =>
      this.routerInterface.encodeFunctionData(contractMethod, params);
    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionName(): string[] {
    return this.directFunctionName;
  }
}
