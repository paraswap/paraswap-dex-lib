import { UnoptimizedRate } from '../types';
import { CurveV2 } from './curve-v2';
import { IDexTxBuilder, DexContructor, IDex, IRouteOptimizer } from './idex';
import { Jarvis } from './jarvis';
import { JarvisV6 } from './jarvis-v6/jarvis-v6';
import { StablePool } from './stable-pool';
import { Weth } from './weth/weth';
import { ZeroX } from './zerox';
import { UniswapV3 } from './uniswap-v3/uniswap-v3';
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
import { IDexHelper } from '../dex-helper';
import { SwapSide } from '../constants';
import { Adapters } from '../types';
import { Lido } from './lido';
import { Excalibur } from './uniswap-v2/excalibur';
import { MakerPsm } from './maker-psm/maker-psm';
import { KyberDmm } from './kyberdmm/kyberdmm';
import { Platypus } from './platypus/platypus';
import { GMX } from './gmx/gmx';
import { WooFiV2 } from './woo-fi-v2/woo-fi-v2';
import { ParaSwapLimitOrders } from './paraswap-limit-orders/paraswap-limit-orders';
import { AugustusRFQOrder } from './augustus-rfq';
import { Solidly } from './solidly/solidly';
import { Thena } from './solidly/forks-override/thena';
import { Chronos } from './solidly/forks-override/chronos';
import { Velodrome } from './solidly/forks-override/velodrome';
import { SpiritSwapV2 } from './solidly/forks-override/spiritSwapV2';
import { Synthetix } from './synthetix/synthetix';
import { Cone } from './solidly/forks-override/cone';
import { SoliSnek } from './solidly/forks-override/solisnek';
import { BalancerV1 } from './balancer-v1/balancer-v1';
import { balancerV1Merge } from './balancer-v1/optimizer';
import { CurveV1 } from './curve-v1/curve-v1';
import { CurveFork } from './curve-v1/forks/curve-forks/curve-forks';
import { Swerve } from './curve-v1/forks/swerve/swerve';
import { CurveV1Factory } from './curve-v1-factory/curve-v1-factory';
import { GenericRFQ } from './generic-rfq/generic-rfq';
import { SwaapV1 } from './swaap-v1/swaap-v1';
import { WstETH } from './wsteth/wsteth';
import { Camelot } from './camelot/camelot';
import { Hashflow } from './hashflow/hashflow';
import { SolidlyEthereum } from './solidly/solidly-ethereum';
import { MaverickV1 } from './maverick-v1/maverick-v1';
import { QuickSwapV3 } from './quickswap/quickswap-v3';
import { ThenaFusion } from './quickswap/thena-fusion';
import { TraderJoeV2 } from './trader-joe-v2';
import { SwaapV2 } from './swaap-v2/swaap-v2';
import { SpiritSwapV3 } from './quickswap/spiritswap-v3';
import { TraderJoeV21 } from './trader-joe-v2.1';
import { PancakeswapV3 } from './pancakeswap-v3/pancakeswap-v3';
import { Algebra } from './algebra/algebra';
import { AngleStakedStable } from './angle-staked-stable/angle-staked-stable';

const LegacyDexes = [
  CurveV2,
  StablePool,
  Smoothy,
  ZeroX,
  Bancor,
  BProtocol,
  MStable,
  Shell,
  Onebit,
  Compound,
  OneInchLp,
  DodoV1,
  DodoV2,
  QuickSwapV3,
  ThenaFusion,
  SpiritSwapV3,
  TraderJoeV2,
  TraderJoeV21,
  Jarvis,
  Lido,
  AugustusRFQOrder,
];

const Dexes = [
  CurveV1,
  CurveFork,
  Swerve,
  BalancerV1,
  BalancerV2,
  UniswapV2,
  UniswapV3,
  Algebra,
  PancakeswapV3,
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
  JarvisV6,
  WooFiV2,
  ParaSwapLimitOrders,
  Solidly,
  SolidlyEthereum,
  SpiritSwapV2,
  Thena,
  Chronos,
  Velodrome,
  Cone,
  SoliSnek,
  Synthetix,
  CurveV1Factory,
  SwaapV1,
  WstETH,
  Hashflow,
  MaverickV1,
  Camelot,
  SwaapV2,
  AngleStakedStable,
];

export type LegacyDexConstructor = new (dexHelper: IDexHelper) => IDexTxBuilder<
  any,
  any
>;

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
  genericRFQDexKeys: Set<string> = new Set();
  uniswapV2Alias: string | null;

  public routeOptimizers: IRouteOptimizer<UnoptimizedRate>[] = [
    balancerV1Merge,
    balancerV2Merge,
    uniswapMerge,
  ];

  constructor(
    public dexHelper: IDexHelper,
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

    const handleDex = (newDex: IDex<any, any, any>, key: string) => {
      const _key = key.toLowerCase();
      this.isLegacy[_key] = false;
      this.dexKeys.push(key);
      this.dexInstances[_key] = newDex;

      const sellAdaptersDex = (
        this.dexInstances[_key] as IDex<any, any, any>
      ).getAdapters(SwapSide.SELL);
      if (sellAdaptersDex)
        this.sellAdapters[_key] = sellAdaptersDex.map(({ name, index }) => ({
          adapter: this.dexHelper.config.data.adapterAddresses[name],
          index,
        }));

      const buyAdaptersDex = (
        this.dexInstances[_key] as IDex<any, any, any>
      ).getAdapters(SwapSide.BUY);
      if (buyAdaptersDex)
        this.buyAdapters[_key] = buyAdaptersDex.map(({ name, index }) => ({
          adapter: this.dexHelper.config.data.adapterAddresses[name],
          index,
        }));
    };

    Dexes.forEach(DexAdapter => {
      DexAdapter.dexKeysWithNetwork.forEach(({ key, networks }) => {
        if (networks.includes(network)) {
          const dex = new DexAdapter(network, key, dexHelper);
          handleDex(dex, key);
        }
      });
    });

    const rfqConfigs = dexHelper.config.data.rfqConfigs;
    Object.keys(dexHelper.config.data.rfqConfigs).forEach(rfqName => {
      const dex = new GenericRFQ(
        network,
        rfqName,
        dexHelper,
        rfqConfigs[rfqName],
      );
      handleDex(dex, rfqName);
      this.genericRFQDexKeys.add(rfqName.toLowerCase());
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
        this.dexHelper,
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
      throw new Error(`Invalid Dex Key ${key}`);

    return this.dexInstances[_key] as IDex<any, any, any>;
  }

  getAllDexAdapters(side: SwapSide = SwapSide.SELL) {
    return side === SwapSide.SELL ? this.sellAdapters : this.buyAdapters;
  }

  getDexKeySpecial(dexKey: string, isAdapters: boolean = false) {
    dexKey = dexKey.toLowerCase();
    if (this.genericRFQDexKeys.has(dexKey)) {
      return dexKey;
    }
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
