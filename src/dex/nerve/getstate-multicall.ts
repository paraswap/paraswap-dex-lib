import _ from 'lodash';
import { DeepReadonly } from 'ts-essentials';
import type { NerveEventMetapool } from './nerve-metapool';
import {
  PoolState,
  MetapoolState,
  EventPoolOrMetapool,
  PoolOrMetapoolState,
} from './types';

async function _getManyPoolStates(
  pools: EventPoolOrMetapool[],
  multi: any,
  blockNumber: number | 'latest' = 'latest',
): Promise<PoolOrMetapoolState[]> {
  const calldata = _(pools)
    .map((pool: EventPoolOrMetapool) => [
      {
        target: pool.address,
        callData: pool.poolIface.encodeFunctionData('swapStorage', []),
      },
      {
        target: pool.lpToken,
        callData: pool.lpTokenIface.encodeFunctionData('totalSupply', []),
      },
      _.range(0, pool.numTokens).map(poolIndex => ({
        target: pool.address,
        callData: pool.poolIface.encodeFunctionData('getTokenBalance', [
          poolIndex,
        ]),
      })),
      (pool as NerveEventMetapool).basePool
        ? [
            {
              target: pool.address,
              callData: pool.poolIface.encodeFunctionData(
                'metaSwapStorage',
                [],
              ),
            },
          ]
        : null,
    ])
    .flattenDeep()
    .filter(a => !!a)
    .value();

  const data = await multi.methods.aggregate(calldata).call({}, blockNumber);

  let p = 0;
  return pools.map((pool: EventPoolOrMetapool) => {
    const swapStorage = pool.poolIface.decodeFunctionResult(
      'swapStorage',
      data.returnData[p++],
    );
    const _state: PoolState = {
      initialA: BigInt('0'),
      futureA: BigInt('0'),
      initialATime: BigInt('0'),
      futureATime: BigInt('0'),
      swapFee: BigInt('0'),
      adminFee: BigInt('0'),
      defaultDepositFee: BigInt('0'),
      defaultWithdrawFee: BigInt('0'),
      lpToken_supply: BigInt('0'),
      balances: [BigInt('0')],
      tokenPrecisionMultipliers: [BigInt('0')],
      isValid: true,
    };
    return (pool as NerveEventMetapool).basePool
      ? {
          ..._state,
          baseVirtualPrice: BigInt('0'),
          baseCacheLastUpdated: BigInt('0'),
        }
      : _state;
  });
}

export async function getManyPoolStates(
  pools: EventPoolOrMetapool[],
  multi: any,
  blockNumber: number | 'latest' = 'latest',
): Promise<DeepReadonly<PoolOrMetapoolState>[]> {
  const _poolsMap = _.reduce(
    pools,
    (
      acc: { [key: string]: EventPoolOrMetapool },
      pool: EventPoolOrMetapool,
    ) => {
      acc[pool.address.toLowerCase()] = pool;
      const _basepool = (pool as NerveEventMetapool).basePool;
      if (_basepool) acc[_basepool.address] = _basepool;
      return acc;
    },
    {},
  );
  const _poolStates = await _getManyPoolStates(
    Object.values(_poolsMap),
    multi,
    blockNumber,
  );

  const _poolStatesMap = _.reduce(
    Object.keys(_poolsMap),
    (acc: { [key: string]: PoolOrMetapoolState }, add: string, i: number) => {
      acc[add] = _poolStates[i];
      return acc;
    },
    {},
  );

  return _.map(pools, (pool: EventPoolOrMetapool) =>
    (pool as NerveEventMetapool).basePool
      ? ({
          ..._poolStatesMap[pool.address.toLowerCase()],
          basePool:
            _poolStatesMap[
              (pool as NerveEventMetapool).basePool.address.toLowerCase()
            ],
        } as MetapoolState)
      : (_poolStatesMap[pool.address.toLowerCase()] as PoolState),
  ) as DeepReadonly<PoolOrMetapoolState>[];
}
