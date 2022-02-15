import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { IDexTxBuilder, DexContructor, IDex } from './idex';
import { Jarvis } from './jarvis';
import { KyberDmm } from './kyberdmm';
import { StablePool } from './stable-pool';
import { UniswapV2 } from './uniswap-v2';
import { Weth } from './weth';
import { ZeroX } from './zerox';
import { UniswapV3 } from './uniswap-v3';
import { Balancer } from './balancer';
import { BalancerV2 } from './balancer-v2/balancer-v2';
import { Bancor } from './bancor';
import { BProtocol } from './bProtocol';
import { MStable } from './mStable';
import { Shell } from './shell';
import { Onebit } from './onebit';
import { Compound } from './compound';
import { AaveV1 } from './aave-v1';
import { AaveV2 } from './aave-v2';
import { OneInchLp } from './OneInchLp';
import { DodoV1 } from './dodo-v1';
import { DodoV2 } from './dodo-v2';
import { Smoothy } from './smoothy';
import { Kyber } from './kyber';
import { IDexHelper } from '../dex-helper/idex-helper';

const LegacyDexes = [
  UniswapV2,
  Curve,
  CurveV2,
  StablePool,
  Smoothy,
  ZeroX,
  Weth,
  Balancer,
  Bancor,
  Kyber,
  BProtocol,
  MStable,
  Shell,
  Onebit,
  Compound,
  AaveV1,
  AaveV2,
  OneInchLp,
  DodoV1,
  DodoV2,
  UniswapV3,
  Weth,
  KyberDmm,
  Jarvis,
];

const Dexes = [BalancerV2];

export type LegacyDexConstructor = new (
  augustusAddress: Address,
  network: number,
  provider: JsonRpcProvider,
) => IDexTxBuilder<any, any>;

interface IGetDirectFunctionName {
  getDirectFunctionName?(): string[];
}

export class DexAdapterService {
  dexToKeyMap: {
    [key: string]: LegacyDexConstructor | DexContructor<any, any, any>;
  } = {};
  directFunctionsNames: string[];
  txBuilderDexInstances: { [key: string]: IDexTxBuilder<any, any> } = {};
  isLegacy: { [dexKey: string]: boolean } = {};
  // dexKeys only has keys for non legacy dexes
  dexKeys: string[] = [];

  constructor(private dexHelper: IDexHelper, private network: number) {
    LegacyDexes.forEach(DexAdapter => {
      DexAdapter.dexKeys.forEach(key => {
        this.dexToKeyMap[key.toLowerCase()] = DexAdapter;
        this.isLegacy[key.toLowerCase()] = true;
      });
    });

    Dexes.forEach(DexAdapter => {
      DexAdapter.dexKeysWithNetwork.forEach(({ key, networks }) => {
        if (networks.includes(network)) {
          this.dexToKeyMap[key.toLowerCase()] = DexAdapter;
          this.isLegacy[key.toLowerCase()] = false;
          this.dexKeys.push(key);
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
  }

  getTxBuilderDexByKey(dexKey: string): IDexTxBuilder<any, any> {
    let _dexKey = dexKey.toLowerCase();

    if (/^paraswappool(.*)/i.test(_dexKey)) _dexKey = 'zerox';

    if (this.txBuilderDexInstances[_dexKey])
      return this.txBuilderDexInstances[_dexKey];

    const DexAdapter = this.dexToKeyMap[_dexKey];
    if (!DexAdapter) throw new Error(`${dexKey} dex is not supported!`);

    if (this.isLegacy[dexKey]) {
      this.txBuilderDexInstances[_dexKey] =
        new (DexAdapter as LegacyDexConstructor)(
          this.dexHelper.augustusAddress,
          this.network,
          this.dexHelper.provider,
        );
    } else {
      this.txBuilderDexInstances[_dexKey] = new (DexAdapter as DexContructor<
        any,
        any,
        any
      >)(this.network, _dexKey, this.dexHelper);
    }

    return this.txBuilderDexInstances[_dexKey];
  }

  isDirectFunctionName(functionName: string): boolean {
    return this.directFunctionsNames.includes(functionName.toLowerCase());
  }

  getAllDexKeys() {
    return this.dexKeys;
  }

  getDexes(dexKeys: string[]): { [dexKey: string]: IDex<any, any, any> } {
    return dexKeys.reduce(
      (acc: { [dexKey: string]: IDex<any, any, any> }, key) => {
        const _key = key.toLowerCase();
        if (!(_key in this.isLegacy) || this.isLegacy[_key])
          throw new Error('Invalid Dex Key');

        if (!this.txBuilderDexInstances[_key]) {
          const DexAdapter = this.dexToKeyMap[_key] as DexContructor<
            any,
            any,
            any
          >;
          this.txBuilderDexInstances[_key] = new DexAdapter(
            this.network,
            _key,
            this.dexHelper,
          );
        }

        acc[_key] = this.txBuilderDexInstances[_key] as IDex<any, any, any>;
        return acc;
      },
      {},
    );
  }
}
