import _ from 'lodash';
import { NerveEventMetapool } from './nerve-metapool';
import { NerveEventPool } from './nerve-pool';
import { PoolState, MetapoolState } from './types';

const biginterify = (val: any) => BigInt(val);
const stringify = (val: any) => val.toString();
const strbify = (val: any) => biginterify(stringify(val));

async function _getManyPoolStates(
  pools: (NerveEventPool | NerveEventMetapool)[],
  multi: any,
  blockNumber: number | 'latest' = 'latest',
): Promise<(PoolState | Partial<MetapoolState>)[]> {
  const calldata = _(pools)
    .map((pool: NerveEventPool | NerveEventMetapool) => [
      {
        target: pool.poolAddress,
        callData: pool.poolIface.encodeFunctionData('swapStorage', []),
      },
      {
        target: pool.lpTokenAddress,
        callData: pool.lpTokenIface.encodeFunctionData('totalSupply', []),
      },
      _.range(0, pool.numTokens).map(poolIndex => ({
        target: pool.poolAddress,
        callData: pool.poolIface.encodeFunctionData('getTokenBalance', [
          poolIndex,
        ]),
      })),
      (pool as NerveEventMetapool).basePool
        ? [
            {
              target: pool.poolAddress,
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
  return pools.map((pool: NerveEventPool | NerveEventMetapool) => {
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
  pools: (NerveEventPool | NerveEventMetapool)[],
  multi: any,
  blockNumber: number | 'latest' = 'latest',
): Promise<(PoolState | MetapoolState)[]> {
  const _poolsMap = _.reduce(
    pools,
    (
      acc: { [key: string]: NerveEventPool | NerveEventMetapool },
      pool: NerveEventPool | NerveEventMetapool,
    ) => {
      acc[pool.poolAddress.toLowerCase()] = pool;
      const _basepool = (pool as NerveEventMetapool).basePool;
      if (_basepool) acc[_basepool.poolAddress] = _basepool;
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
    (
      acc: { [key: string]: PoolState | Partial<MetapoolState> },
      add: string,
      i: number,
    ) => {
      acc[add] = _poolStates[i];
      return acc;
    },
    {},
  );

  return _.map(pools, (pool: NerveEventPool | NerveEventMetapool) =>
    (pool as NerveEventMetapool).basePool
      ? ({
          ..._poolStatesMap[pool.poolAddress.toLowerCase()],
          basePoolState:
            _poolStatesMap[
              (pool as NerveEventMetapool).basePool.poolAddress.toLowerCase()
            ],
        } as MetapoolState)
      : (_poolStatesMap[pool.poolAddress.toLowerCase()] as PoolState),
  );
}
