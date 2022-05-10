import { Provider } from '@ethersproject/providers';
import { Address, UnoptimizedRate } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { IDexTxBuilder, DexContructor, IDex, IRouteOptimizer } from './idex';
import { Jarvis } from './jarvis';
import { StablePool } from './stable-pool';
import { Weth } from './weth/weth';
import { ZeroX } from './zerox';
import { UniswapV3 } from './uniswap-v3';
import { Balancer } from './balancer';
import { BalancerV2 } from './balancer-v2/balancer-v2';
import { balancerV2Merge } from './balancer-v2/optimizer';
import { UniswapV2 } from './uniswap-v2/uniswap-v2';
import { UniswapV2Alias } from './uniswap-v2/constants';
import { uniswapMerge } from './uniswap-v2/optimizer';
import { BiSwap } from './uniswap-v2/biswap';
import { MDEX } from './uniswap-v2/mdex';
import { Dfyn } from './uniswap-v2/dfyn';
import { Bancor } from './bancor';
import { BProtocol } from './bProtocol';
import { MStable } from './mStable';
import { Shell } from './shell';
import { Onebit } from './onebit';
import { Compound } from './compound';
import { AaveV1 } from './aave-v1/aave-v1';
import { AaveV2 } from './aave-v2/aave-v2';
import { AaveV3 } from './aave-v3/aave-v3';
import { OneInchLp } from './OneInchLp';
import { DodoV1 } from './dodo-v1';
import { DodoV2 } from './dodo-v2';
import { Smoothy } from './smoothy';
import { Nerve } from './nerve/nerve';
import { IDexHelper } from '../dex-helper/idex-helper';
import { SwapSide, Network } from '../constants';
import { Adapters } from '../types';
import { Lido } from './lido';
import { Excalibur } from './uniswap-v2/excalibur';
import { MakerPsm } from './maker-psm/maker-psm';
import { KyberDmm } from './kyberdmm/kyberdmm';
import { Platypus } from './platypus/platypus';
import { GMX } from './gmx/gmx';
import { WooFi } from './woo-fi/woo-fi';

const LegacyDexes = [
  Curve,
  CurveV2,
  StablePool,
  Smoothy,
  ZeroX,
  Balancer,
  Bancor,
  BProtocol,
  MStable,
  Shell,
  Onebit,
  Compound,
  OneInchLp,
  DodoV1,
  DodoV2,
  UniswapV3,
  Jarvis,
  Lido,
];

const Dexes = [
  BalancerV2,
  UniswapV2,
  BiSwap,
  MDEX,
  Dfyn,
  Excalibur,
  AaveV1,
  AaveV2,
  AaveV3,
  KyberDmm,
  Weth,
  MakerPsm,
  Nerve,
  Platypus,
  GMX,
  WooFi
];

const AdapterNameAddressMap: {
  [network: number]: { [name: string]: Address };
} = {
  [Network.MAINNET]: {
    Adapter01: '0x3a0430bf7cd2633af111ce3204db4b0990857a6f',
    Adapter02: '0xFC2Ba6E830a04C25e207B8214b26d8C713F6881F',
    Adapter03: '0x9Cf0b60C2133f67443fdf8a1bB952E2e6783d5DF',
    BuyAdapter: '0x8D562A7D63248Ebfdd19B26665161cf867e5c10A',
  },
  [Network.POLYGON]: {
    PolygonAdapter01: '0xD458FA906121d9081970Ed3937df50C8Ba88E9c0',
    PolygonAdapter02: '0xe56823aC543c81f747eD95F3f095b5A19224bd3a',
    PolygonBuyAdapter: '0x34E0E6448A648Fc0b340679C4F16e5ACC4Bf4c95',
  },
  [Network.BSC]: {
    BscAdapter01: '0xcEC935682c0b510fb91c0A12275Bb7e14EEBE87c',
    BscBuyAdapter: '0xdA0DAFbbC95d96bAb164c847112e15c0299541f6',
  },
  [Network.ROPSTEN]: {
    RopstenAdapter01: '0x74fF86C61CF66334dCfc999814DE4695B4BaE57b',
    RopstenBuyAdapter: '0xDDbaC07C9ef96D6E792c25Ff934E7e111241BFf1',
  },
  [Network.AVALANCHE]: {
    AvalancheAdapter01: '0xaaD116D3b51893bD00bFBAf337824A15796eD97a',
    AvalancheBuyAdapter: '0x05d0c2b58fF6c05bcc3e5F2D797bEB77e0A4CC7b',
  },
  [Network.FANTOM]: {
    FantomAdapter01: '0x7EE3C983cA38c370F296FE14a31bEaC5b1c9a9FE',
    FantomBuyAdapter: '0x3032B8c9CF91C791A8EcC2c7831A11279f419386',
  },
};

export type LegacyDexConstructor = new (
  augustusAddress: Address,
  network: number,
  provider: Provider,
) => IDexTxBuilder<any, any>;

interface IGetDirectFunctionName {
  getDirectFunctionName?(): string[];
}

export class DexAdapterService {
  dexToKeyMap: {
    [key: string]: LegacyDexConstructor | DexContructor<any, any, any>;
  } = {};
  directFunctionsNames: string[];
  dexInstances: {
    [key: string]: IDexTxBuilder<any, any> | IDex<any, any, any>;
  } = {};
  isLegacy: { [dexKey: string]: boolean } = {};
  // dexKeys only has keys for non legacy dexes
  dexKeys: string[] = [];
  uniswapV2Alias: string | null;

  public routeOptimizers: IRouteOptimizer<UnoptimizedRate>[] = [
    balancerV2Merge,
    uniswapMerge,
  ];

  constructor(
    private dexHelper: IDexHelper,
    public network: number,
    protected sellAdapters: Adapters = {},
    protected buyAdapters: Adapters = {},
  ) {
    LegacyDexes.forEach(DexAdapter => {
      DexAdapter.dexKeys.forEach(key => {
        this.dexToKeyMap[key.toLowerCase()] = DexAdapter;
        this.isLegacy[key.toLowerCase()] = true;
      });
    });

    Dexes.forEach(DexAdapter => {
      DexAdapter.dexKeysWithNetwork.forEach(({ key, networks }) => {
        if (networks.includes(network)) {
          const _key = key.toLowerCase();
          this.isLegacy[_key] = false;
          this.dexKeys.push(key);
          this.dexInstances[_key] = new DexAdapter(
            this.network,
            key,
            this.dexHelper,
          );

          const sellAdaptersDex = (
            this.dexInstances[_key] as IDex<any, any, any>
          ).getAdapters(SwapSide.SELL);
          if (sellAdaptersDex)
            this.sellAdapters[_key] = sellAdaptersDex.map(
              ({ name, index }) => ({
                adapter: AdapterNameAddressMap[network][name],
                index,
              }),
            );

          const buyAdaptersDex = (
            this.dexInstances[_key] as IDex<any, any, any>
          ).getAdapters(SwapSide.BUY);
          if (buyAdaptersDex)
            this.buyAdapters[_key] = buyAdaptersDex.map(({ name, index }) => ({
              adapter: AdapterNameAddressMap[network][name],
              index,
            }));
        }
      });
    });

    this.directFunctionsNames = [...LegacyDexes, ...Dexes]
      .flatMap(dexAdapter => {
        const _dexAdapter = dexAdapter as IGetDirectFunctionName;
        return _dexAdapter.getDirectFunctionName
          ? _dexAdapter.getDirectFunctionName()
          : [];
      })
      .filter(x => !!x)
      .map(v => v.toLowerCase());

    this.uniswapV2Alias =
      this.network in UniswapV2Alias
        ? UniswapV2Alias[this.network].toLowerCase()
        : null;
  }

  getTxBuilderDexByKey(dexKey: string): IDexTxBuilder<any, any> {
    let _dexKey = this.getDexKeySpecial(dexKey);

    if (!this.dexInstances[_dexKey]) {
      const DexAdapter = this.dexToKeyMap[_dexKey];
      if (!DexAdapter)
        throw new Error(
          `${dexKey} dex is not supported for network(${this.network})!`,
        );

      this.dexInstances[_dexKey] = new (DexAdapter as LegacyDexConstructor)(
        this.dexHelper.augustusAddress,
        this.network,
        this.dexHelper.provider,
      );
    }

    return this.dexInstances[_dexKey];
  }

  isDirectFunctionName(functionName: string): boolean {
    return this.directFunctionsNames.includes(functionName.toLowerCase());
  }

  getAllDexKeys() {
    return this.dexKeys;
  }

  getDexByKey(key: string): IDex<any, any, any> {
    const _key = key.toLowerCase();
    if (!(_key in this.isLegacy) || this.isLegacy[_key])
      throw new Error('Invalid Dex Key');

    return this.dexInstances[_key] as IDex<any, any, any>;
  }

  getAllDexAdapters(side: SwapSide = SwapSide.SELL) {
    return side === SwapSide.SELL ? this.sellAdapters : this.buyAdapters;
  }

  getDexKeySpecial(dexKey: string, isAdapters: boolean = false) {
    dexKey = dexKey.toLowerCase();
    if (!isAdapters && /^paraswappool(.*)/i.test(dexKey)) return 'zerox';
    else if ('uniswapforkoptimized' === dexKey) {
      if (!this.uniswapV2Alias)
        throw new Error(
          `${dexKey} dex is not supported for network(${this.network})!`,
        );
      return this.uniswapV2Alias;
    }
    return dexKey;
  }

  getAdapter(dexKey: string, side: SwapSide) {
    const specialDexKey = this.getDexKeySpecial(dexKey, true);
    return side === SwapSide.SELL
      ? this.sellAdapters[specialDexKey]
      : this.buyAdapters[specialDexKey];
  }
}
