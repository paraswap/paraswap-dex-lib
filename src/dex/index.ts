import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { DirectFunctions, IDex } from './idex';
import { StablePool } from './stable-pool';
import { UniswapV2 } from './uniswap-v2';
import { UniswapV2Fork } from './uniswap-v2-fork';
import { Weth } from './weth';
import { ZeroX } from './zerox';
import { UniswapV3 } from './uniswap-v3';
import { Balancer } from './balancer';
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

const DexAdapters = [
  UniswapV2,
  Curve,
  CurveV2,
  StablePool,
  UniswapV2Fork,
  ZeroX,
  Weth,
  Balancer,
  Bancor,
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
];

const isWithDirectFunctionName = (
  DexAdapter: any,
): DexAdapter is { getDirectFunctionName: () => DirectFunctions } => {
  return !!DexAdapter?.getDirectFunctionName();
};

export class DexAdapterService {
  dexToKeyMap: {
    [key: string]: new (
      augustusAddress: Address,
      networkId: number,
      provider: JsonRpcProvider,
    ) => IDex<any, any>;
  };
  directFunctionsNames: string[];
  dexInstances: { [network: number]: { [key: string]: IDex<any, any> } } = {};
  constructor(
    private augustusAddress: string,
    private provider: JsonRpcProvider,
  ) {
    this.dexToKeyMap = DexAdapters.reduce<{
      [exchangeName: string]: new (
        augustusAddress: Address,
        networkId: number,
        provider: JsonRpcProvider,
      ) => IDex<any, any>;
    }>((acc, DexAdapter) => {
      DexAdapter.dexKeys.forEach(exchangeName => {
        acc[exchangeName.toLowerCase()] = DexAdapter;
      });

      return acc;
    }, {});

    this.directFunctionsNames = DexAdapters.filter(isWithDirectFunctionName)
      .flatMap(DexAdapter => {
        if (!isWithDirectFunctionName(DexAdapter)) return ''; // filter doesn't seem to suffice to TS compiler
        const directFunctionName = DexAdapter.getDirectFunctionName();

        return [
          directFunctionName.sell?.toLowerCase() || '',
          directFunctionName.buy?.toLowerCase() || '',
        ];
      })
      .filter(x => !!x);
  }

  getDexByKey(dexKey: string, network: number): IDex<any, any> {
    let _dexKey = dexKey.toLowerCase();

    if (/^paraswappool(.*)/i.test(dexKey)) _dexKey = 'zerox';

    if (this.dexInstances[network]?.[dexKey])
      return this.dexInstances[network][dexKey];

    if (!this.dexInstances[network]) this.dexInstances[network] = {};

    const DexAdapter = this.dexToKeyMap[_dexKey];

    this.dexInstances[network][dexKey] = new DexAdapter(
      this.augustusAddress,
      network,
      this.provider,
    );

    return this.dexInstances[network][dexKey];
  }

  isDirectFunctionName(functionName: string): boolean {
    return this.directFunctionsNames.includes(functionName.toLowerCase());
  }
}
