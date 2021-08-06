import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { IDex } from './idex';
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

const reduceKeyAdapterOffExchangeName = (
  exchangeName: string,
): { key: string; DexAdapter: typeof DexAdapters[0] } => {
  if (/^paraswappool(.*)/i.test(exchangeName))
    return { key: '0x', DexAdapter: ZeroX };

  const MatchingDexAdapter = DexAdapters.find(d =>
    d.ExchangeNames.map(k => k.toLowerCase()).includes(
      exchangeName.toLowerCase(),
    ),
  );

  if (!MatchingDexAdapter)
    throw `failed to find MatchingDex for ${exchangeName}`;

  const firstMatchingDexExchangeName =
    MatchingDexAdapter.ExchangeNames?.[0]?.toLowerCase();

  if (!firstMatchingDexExchangeName)
    throw `failed to find firstMatchingDexExchangeName for ${exchangeName}`;

  return { key: firstMatchingDexExchangeName, DexAdapter: MatchingDexAdapter };
};

export type DexAdapterLocator = (
  networkId: number,
  exchangeName: string,
) => IDex<any, any>;

export function buildDexAdapterLocator(
  augustusAddress: Address,
  provider: JsonRpcProvider,
): DexAdapterLocator {
  const networkToAdapters: {
    [networkId: string]: { [key: string]: IDex<any, any> };
  } = {};

  return (networkId: number, exchangeName: string) => {
    const { key, DexAdapter } = reduceKeyAdapterOffExchangeName(exchangeName);

    if (networkToAdapters[networkId]?.[key])
      return networkToAdapters[networkId][key];

    if (!networkToAdapters[networkId]) networkToAdapters[networkId] = {};

    networkToAdapters[networkId][key] = new DexAdapter(
      augustusAddress,
      networkId,
      provider,
    );

    return networkToAdapters[networkId][key];
  };
}
