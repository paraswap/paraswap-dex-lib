import { CurveMetapool, MetapoolState } from './curve-metapool';
import { CurvePool, PoolState } from './curve-pool';
import _ from 'lodash';
import { erc20Iface } from '../../../lib/utils-interfaces';
import { bignumberify, stringify } from '../../../utils';

const strbnify = (val: any) => bignumberify(stringify(val));

async function _getManyPoolStates(
  pools: (CurvePool | CurveMetapool)[],
  multi: any,
  blockNumber: number | 'latest' = 'latest',
): Promise<(PoolState | Partial<MetapoolState>)[]> {
  const calldata = _(pools)
    .map((pool: CurvePool | CurveMetapool) => [
      {
        target: pool.address,
        callData: pool.poolIface.encodeFunctionData('admin_fee', []),
      },
      {
        target: pool.address,
        callData: pool.poolIface.encodeFunctionData('fee', []),
      },
      {
        target: pool.address,
        callData: pool.poolIface.encodeFunctionData('A', []),
      },
      {
        target: pool.tokenAddress,
        callData: erc20Iface.encodeFunctionData('totalSupply', []),
      },
      _.range(0, pool.N_COINS).map(poolIndex => ({
        target: pool.address,
        callData: pool.poolIface.encodeFunctionData('balances', [poolIndex]),
      })),
      (pool as CurveMetapool).basepool
        ? [
            {
              target: pool.address,
              callData: pool.poolIface.encodeFunctionData(
                'base_cache_updated',
                [],
              ),
            },
            {
              target: pool.address,
              callData: pool.poolIface.encodeFunctionData(
                'base_virtual_price',
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
  return pools.map((pool: CurvePool | CurveMetapool) => {
    const _state = {
      admin_fee: strbnify(
        pool.poolIface.decodeFunctionResult(
          'admin_fee',
          data.returnData[p++],
        )[0],
      ),
      fee: strbnify(
        pool.poolIface.decodeFunctionResult('fee', data.returnData[p++])[0],
      ),
      A: strbnify(
        pool.poolIface.decodeFunctionResult('A', data.returnData[p++])[0],
      ),
      supply: strbnify(
        erc20Iface.decodeFunctionResult('totalSupply', data.returnData[p++])[0],
      ),
      balances: _.range(0, pool.N_COINS).map(i =>
        strbnify(
          pool.poolIface.decodeFunctionResult(
            'balances',
            data.returnData[p++],
          )[0],
        ),
      ),
    };
    return (pool as CurveMetapool).basepool
      ? {
          ..._state,
          base_cache_updated: strbnify(
            pool.poolIface.decodeFunctionResult(
              'base_cache_updated',
              data.returnData[p++],
            )[0],
          ),
          base_virtual_price: strbnify(
            pool.poolIface.decodeFunctionResult(
              'base_virtual_price',
              data.returnData[p++],
            )[0],
          ),
        }
      : _state;
  });
}

export async function getManyPoolStates(
  pools: (CurvePool | CurveMetapool)[],
  multi: any,
  blockNumber: number | 'latest' = 'latest',
): Promise<(PoolState | MetapoolState)[]> {
  const _poolsMap = _.reduce(
    pools,
    (
      acc: { [key: string]: CurvePool | CurveMetapool },
      pool: CurvePool | CurveMetapool,
    ) => {
      acc[pool.address.toLowerCase()] = pool;
      const _basepool = (pool as CurveMetapool).basepool;
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

  return _.map(pools, (pool: CurvePool | CurveMetapool) =>
    (pool as CurveMetapool).basepool
      ? ({
          ..._poolStatesMap[pool.address.toLowerCase()],
          basepool:
            _poolStatesMap[
              (pool as CurveMetapool).basepool.address.toLowerCase()
            ],
        } as MetapoolState)
      : (_poolStatesMap[pool.address.toLowerCase()] as PoolState),
  );
}
