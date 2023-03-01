import { Logger } from 'log4js';
import { Network } from '../../../constants';
import { IDexHelper } from '../../../dex-helper';
import { Utils, _require } from '../../../utils';
import { PoolState } from '../types';
import { PoolPollingBase } from './pool-polling-base';

/*
 * Since we are updating all pools state at once, I need some generalized iterator without state,
 * just to go for every pool, get multicall requests and apply them into new state
 */

export class StatePollingManager {
  static async fetchAndSetStatesFromRPC(
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ): Promise<PoolState[]> {
    if (pools.length === 0) {
      return [];
    }

    const newStates = new Array(pools.length);

    const poolResultDividers = new Array<number>(pools.length).fill(0);
    const callDatas = pools
      .map((p, i) => {
        const poolCalldata = p.getStateMultiCalldata();
        poolResultDividers[i] = poolCalldata.length;
        return poolCalldata;
      })
      .flat();

    let _blockNumber = blockNumber;
    if (_blockNumber === undefined) {
      // If we were not given with blockNumber, set state blockNumber to 0,
      // that is indicating that block number was the latest.
      // If we request here latest blockNumber and try to send query, we frequently
      // hit problem with late nodes. Some node may give us blockNumber 10,
      // but when trying to do query we may hit node that is only on 9 blocknumber
      // And it is a problem. Especially on Optimism and Avalanche.
      _blockNumber = 0;
    }

    const result = await dexHelper.multiWrapper.aggregate(
      callDatas,
      blockNumber,
      1000,
    );
    const updatedAt = Date.now();

    let lastStart = 0;

    for (const [i, p] of pools.entries()) {
      const newState = p.parseMultiResultsToStateValues(
        result.slice(lastStart, lastStart + poolResultDividers[i]),
        _blockNumber,
        updatedAt,
      );
      p.setState(newState);
      newStates[i] = newState;
      lastStart += poolResultDividers[i];
    }

    return newStates;
  }

  static async masterUpdatePoolsInBatch(
    logger: Logger,
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ) {
    const dexKey = pools.length > 0 ? pools[0].dexKey : 'CurveV1Factory';
    try {
      const newStates = await StatePollingManager.fetchAndSetStatesFromRPC(
        dexHelper,
        pools,
        blockNumber,
      );
      _require(
        newStates.length === pools.length,
        "newStates length doesn't match pools length",
        { poolLength: pools.length, newStatesLength: newStates.length },
        'newStates.length === pools.length',
      );
      await Promise.all(
        pools.map(async (p, i) => {
          await dexHelper.cache.hset(
            p.cacheStateKey,
            p.poolIdentifier,
            Utils.Serialize(newStates[i]),
          );
        }),
      );
      logger.info(
        `${dexKey}: all (${pools.length}) pools state was successfully updated on network ${dexHelper.config.data.network}`,
      );
    } catch (e) {
      logger.error(
        `${dexKey}: On network ${
          dexHelper.config.data.network
        } failed to update state for pools: ${pools
          .slice(0, 10)
          .map(p => p.address)
          .join(', ')}${pools.length > 10 ? '...' : ''}: `,
        e,
      );
    }
  }

  static async slaveUpdatePoolsInBatch(
    logger: Logger,
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ) {
    const dexKey = pools.length > 0 ? pools[0].dexKey : 'CurveV1Factory';
    const poolsForRPCUpdate: PoolPollingBase[] = [];

    await Promise.all(
      pools.map(async p => {
        try {
          const unparsedStateFromCache = await dexHelper.cache.hget(
            p.cacheStateKey,
            p.poolIdentifier,
          );
          if (unparsedStateFromCache !== null) {
            const parsedState = Utils.Parse(
              unparsedStateFromCache,
            ) as PoolState;

            if (p.isStateUpToDate(parsedState)) {
              p.setState(parsedState);
              return;
            }
          }
        } catch (e) {
          logger.error(
            `${p.dexKey}-${p.poolIdentifier}: Error getting state from cache: `,
            e,
          );
        }

        if (p.baseStatePoolPolling) {
          poolsForRPCUpdate.push(p.baseStatePoolPolling);
        }

        poolsForRPCUpdate.push(p);
      }),
    );

    if (poolsForRPCUpdate.length === 0) {
      return;
    }

    try {
      logger.warn(
        `${dexKey}: ${poolsForRPCUpdate.length} pools: ${poolsForRPCUpdate
          .map(p => p.address)
          .join(', ')} don't have state in cache on network ${
          dexHelper.config.data.network
        }. Falling back to RPC`,
      );

      await StatePollingManager.fetchAndSetStatesFromRPC(
        dexHelper,
        poolsForRPCUpdate,
        blockNumber,
      );
      return;
    } catch (e) {
      logger.error(
        `${dexKey}: On network ${
          dexHelper.config.data.network
        } failed to fetch state from RPC for pools: ${pools
          .slice(0, 10)
          .map(p => p.address)
          .join(', ')}${pools.length > 10 ? '...' : ''}: `,
        e,
      );
      return;
    }
  }

  static async updatePoolsInBatch(
    logger: Logger,
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
    liquidityUpdateFunc?: Function,
  ) {
    if (pools.length === 0) {
      return;
    }

    if (liquidityUpdateFunc) {
      await liquidityUpdateFunc();
    }

    if (dexHelper.config.isSlave) {
      await StatePollingManager.slaveUpdatePoolsInBatch(
        logger,
        dexHelper,
        pools,
        blockNumber,
      );
    } else {
      await StatePollingManager.masterUpdatePoolsInBatch(
        logger,
        dexHelper,
        pools,
        blockNumber,
      );
    }

    logger.trace(
      `CurveV1Factory: finished state update for ${pools.length} pools on network ${dexHelper.config.data.network}`,
    );
  }
}
