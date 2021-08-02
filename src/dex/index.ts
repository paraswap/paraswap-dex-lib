import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { DexMap, IDex } from './idex';
import { StablePool } from './stable-pool';
import { UniswapV2 } from './uniswap-v2';
import { UniswapV3 } from './uniswap-v3';
import { ZeroX } from './zerox';
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

const dexes = [
  UniswapV2,
  Curve,
  CurveV2,
  StablePool,
  ZeroX,
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
];

export function getDexMap(
  augustusAddress: Address,
  network: number,
  provider: JsonRpcProvider,
): DexMap {
  return dexes.reduce(
    (
      acc: DexMap,
      dex: new (
        augustusAddress: Address,
        network: number,
        provider: JsonRpcProvider,
      ) => IDex<any, any>,
    ) => {
      const dexObj = new dex(augustusAddress, network, provider);
      dexObj.getDEXKeys().forEach(dexKeys => {
        // temp: move to findDexByKey instead
        acc[dexKeys] = dexObj;
      });
      return acc;
    },
    {},
  );
}
