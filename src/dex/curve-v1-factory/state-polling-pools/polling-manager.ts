import { Logger } from 'log4js';
import { IDexHelper } from '../../../dex-helper';
import { Utils, _require } from '../../../utils';
import { PoolState } from '../types';
import { PoolPollingBase } from './pool-polling-base';

/*
 * Since we are updating all pools state at once, I need some generalized iterator without state,
 * just to go for every pool, get multicall requests and apply them into new state
 */
export class StatePollingManager {
  static async fetchStatesFromRPC(
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ): Promise<PoolState[]> {
    if (pools.length === 0) {
      return [];
    }

    const newStates = new Array(pools.length);

    const poolResultDivider = new Array<number>(pools.length).fill(0);
    const callDatas = pools
      .map((p, i) => {
        const poolCalldata = p.getStateMultiCalldata();
        poolResultDivider[i] = poolCalldata.length;
        return poolCalldata;
      })
      .flat();

    const _blockNumber =
      blockNumber !== undefined
        ? blockNumber
        : dexHelper.blockManager.getLatestBlockNumber();

    const result = await dexHelper.multiWrapper.aggregate(
      callDatas,
      3000,
      _blockNumber,
    );
    const updatedAt = Date.now();

    let lastStart = 0;

    await Promise.all(
      pools.map(async (p, i) => {
        const newState = p.parseMultiResultsToStateValues(
          result.slice(lastStart, lastStart + poolResultDivider[i]),
          _blockNumber,
          updatedAt,
        );
        newStates[i] = newState;
        lastStart += poolResultDivider[i];
      }),
    );
    return newStates;
  }

  static async masterUpdatePoolsInBatch(
    logger: Logger,
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ) {
    try {
      const newStates = await StatePollingManager.fetchStatesFromRPC(
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
          dexHelper.cache.hset(
            p.cacheStateKey,
            p.poolIdentifier,
            Utils.Parse(newStates[i]),
          );
        }),
      );
    } catch (e) {
      logger.error(
        `${pools.length > 0 ? pools[0].dexKey : 'CurveV1Factory'}: On network ${
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

        logger.warn(
          `${p.dexKey}-${p.poolIdentifier}: state wasn't received from cache. Falling back to RPC`,
        );

        try {
          const [newState] = await StatePollingManager.fetchStatesFromRPC(
            dexHelper,
            [p],
            blockNumber,
          );
          p.setState(newState);
          return;
        } catch (e) {
          logger.error(
            `${p.dexKey}-${p.poolIdentifier}: couldn't update state from RPC:`,
            e,
          );
          return;
        }
      }),
    );
  }

  static async updatePoolsInBatch(
    logger: Logger,
    dexHelper: IDexHelper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ) {
    if (pools.length === 0) {
      return;
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
      `CurveV1Factory: successfully updated state for ${pools.length} pools on network ${dexHelper.config.data.network}`,
    );
  }
}
