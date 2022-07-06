import { Provider } from '@ethersproject/providers';
import { Address, UnoptimizedRate } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { IDexTxBuilder, DexContructor, IDex, IRouteOptimizer } from './idex';
import { Jarvis } from './jarvis';
import { StablePool } from './stable-pool';
import { Weth } from './weth/weth';
import { ZeroX } from './zerox';
import { UniswapV3 } from './uniswap-v3/uniswap-v3';
import { uniswapV3Merge } from './uniswap-v3/optimizer';
import { Balancer } from './balancer';
import { BalancerV2 } from './balancer-v2/balancer-v2';
import { balancerV2Merge } from './balancer-v2/optimizer';
import { UniswapV2 } from './uniswap-v2/uniswap-v2';
import { UniswapV2Alias } from './uniswap-v2/constants';
import { uniswapV2Merge } from './uniswap-v2/optimizer';
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
import { IDexHelper } from '../dex-helper';
import { SwapSide, Network } from '../constants';
import { Adapters } from '../types';
import { Lido } from './lido';
import { Excalibur } from './uniswap-v2/excalibur';
import { MakerPsm } from './maker-psm/maker-psm';
import { KyberDmm } from './kyberdmm/kyberdmm';
import { Platypus } from './platypus/platypus';
import { GMX } from './gmx/gmx';
import { WooFi } from './woo-fi/woo-fi';
import { Dystopia } from './uniswap-v2/dystopia/dystopia';
import { ParaSwapLimitOrders } from './paraswap-limit-orders/paraswap-limit-orders';
import { AugustusRFQOrder } from './augustus-rfq';

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
  Jarvis,
  Lido,
  AugustusRFQOrder,
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
  WooFi,
  UniswapV3,
  Dystopia,
  ParaSwapLimitOrders,
];

const AdapterNameAddressMap: {
  [network: number]: { [name: string]: Address };
} = {
  [Network.MAINNET]: {
    Adapter01: '0xBdd13a9dd364E5557e0710fC1d2Ac145B5e8f3bE',
    Adapter02: '0xFC2Ba6E830a04C25e207B8214b26d8C713F6881F',
    Adapter03: '0xe5993623FF3ecD1f550124059252dDff804b3879',
    BuyAdapter: '0x737E642eec6e5bD675022ADC6D726EB19FF74383',
  },
  [Network.POLYGON]: {
    PolygonAdapter01: '0xa41B5Ab708fe1fe11CD6121006497b8549e8A695',
    PolygonAdapter02: '0x475928fE50a9E9ADb706d6f5624fB97EE2AC087D',
    PolygonBuyAdapter: '0xD7d3E2491cc495faAa9a770cBDC7535fD1446D8C',
  },
  [Network.BSC]: {
    BscAdapter01: '0xC9229EeC07B176AcC448BE33177c2834c9575ec5',
    BscBuyAdapter: '0xF52523B9d788F4E2Dd256dc5077879Af0448c37A',
  },
  [Network.ROPSTEN]: {
    RopstenAdapter01: '0x59b7F6258e78C3E5234bb651656EDd0e08868cd5',
    RopstenBuyAdapter: '0x63e908A4C793a33e40254362ED1A5997a234D85C',
  },
  [Network.AVALANCHE]: {
    AvalancheAdapter01: '0xb41Ec6e014e2AD12Ae8514216EAb2592b74F19e7',
    AvalancheBuyAdapter: '0xe92b586627ccA7a83dC919cc7127196d70f55a06',
  },
  [Network.FANTOM]: {
    FantomAdapter01: '0xF52523B9d788F4E2Dd256dc5077879Af0448c37A',
    FantomBuyAdapter: '0x27eb327B7255a2bF666EBB4D60AB4752dA4611b9',
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
    uniswapV2Merge,
    uniswapV3Merge,
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
