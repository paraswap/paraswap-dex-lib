import _ from 'lodash';
import { Logger } from 'log4js';
import { Address } from 'paraswap';
import { IDexHelper } from '../../dex-helper';
import { TaskScheduler } from '../../lib/task-scheduler';
import {
  CURVE_API_URL,
  NETWORK_ID_TO_NAME,
  STATE_UPDATE_PERIOD_MS,
  STATE_UPDATE_RETRY_PERIOD_MS,
} from './constants';
import { PriceHandler } from './price-handlers/price-handler';
import { PoolPollingBase } from './state-polling-pools/pool-polling-base';
import { StatePollingManager } from './state-polling-pools/polling-manager';
import { NULL_ADDRESS } from '../../constants';

/*
 * The idea of FactoryPoolManager is to try to abstract both pool types: fully event based
 * semi event based into one wall `PoolManager`. Currently we only support only
 * semi event based, but it may be extended in future when we make full transition from CurveV1
 */

export class CurveV1FactoryPoolManager {
  // This is needed because we initialize all factory pools + custom pools
  // Custom pools are not fully supported. I need them only in meta pools as base pool
  // to get poolState, but not for pricing requests.
  // It appears from CurveV1 and CurveV1Factory duality
  // Sometimes it happens that as customPool we have factory plain pool, in that case I use
  // isUsedForPricing flag to identify if it must be used for pricing or not. If yes,
  // it goes to statePollingPoolsFromId
  private poolsForOnlyState: Record<string, PoolPollingBase> = {};

  // poolsForOnly State and statePollingPoolsFromId must not have overlapping in pool
  private statePollingPoolsFromId: Record<string, PoolPollingBase> = {};

  // This is fast lookup table when you look for pair and searching for coins in all pools
  // In fact it is skewed in favor of CRV, so we still end up with 100 pools for CRV token.
  // It should bo considered for optimizing
  private coinAddressesToPoolIdentifiers: Record<string, string[]> = {};

  private allCurveLiquidityApiSlugs: Set<string> = new Set(['/factory']);

  private statePollingManager = StatePollingManager;
  private taskScheduler: TaskScheduler;

  constructor(
    private name: string,
    private logger: Logger,
    private dexHelper: IDexHelper,
    private allPriceHandlers: Record<string, PriceHandler>,
    stateUpdatePeriodMs: number = STATE_UPDATE_PERIOD_MS,
    stateUpdateRetryPeriodMs: number = STATE_UPDATE_RETRY_PERIOD_MS,
  ) {
    this.taskScheduler = new TaskScheduler(
      this.name,
      this.logger,
      this.updatePollingPoolsInBatch.bind(this),
      stateUpdatePeriodMs,
      stateUpdateRetryPeriodMs,
    );
  }

  initializePollingPools() {
    // Execute and start timer
    this.taskScheduler.setTimer(0);
  }

  updatePollingPoolsInBatch() {
    this.statePollingManager.updatePoolsInBatch(
      this.logger,
      this.dexHelper.config.data.network,
      this.dexHelper.multiWrapper,
      Object.values(this.statePollingPoolsFromId).concat(
        Object.values(this.poolsForOnlyState),
      ),
    );
  }

  async initializeIndividualPollingPoolState(
    identifier: string,
    isSrcFeeOnTransferTokenToBeExchanged: boolean,
    blockNumber?: number,
  ) {
    const pool = this.getPool(identifier, isSrcFeeOnTransferTokenToBeExchanged);
    if (pool === null) {
      this.logger.error(
        `${identifier}: can not initialize first state for pool`,
      );
      return;
    }

    await this.statePollingManager.updatePoolsInBatch(
      this.logger,
      this.dexHelper.config.data.network,
      this.dexHelper.multiWrapper,
      [pool],
      blockNumber,
    );
  }

  getPriceHandler(implementationAddress: string): PriceHandler {
    return this.allPriceHandlers[implementationAddress];
  }

  releaseResources() {
    this.taskScheduler.releaseResources();
  }

  initializeNewPool(identifier: string, pool: PoolPollingBase) {
    if (this.statePollingPoolsFromId[identifier]) {
      return;
    }

    if (this.poolsForOnlyState[identifier]) {
      throw new Error(
        `${this.name}: pool with ${identifier} is already initialized as custom pool`,
      );
    }

    this.statePollingPoolsFromId[identifier] = pool;

    const allCoins = pool.poolConstants.COINS.concat(
      Object.keys(pool.underlyingCoinsToIndices),
    ).filter(p => p !== NULL_ADDRESS);
    // It is not quite efficient, but since it is done only on init part,
    // I think it should be ok
    allCoins.forEach(c => {
      const identifiers = this.coinAddressesToPoolIdentifiers[c];
      if (identifiers === undefined) {
        this.coinAddressesToPoolIdentifiers[c] = [identifier];
      } else {
        this.coinAddressesToPoolIdentifiers[c].push(identifier);
        this.coinAddressesToPoolIdentifiers[c] = _.uniq(
          this.coinAddressesToPoolIdentifiers[c],
        );
      }
    });

    this.allCurveLiquidityApiSlugs.add(pool.curveLiquidityApiSlug);
  }

  initializeNewPoolForState(identifier: string, pool: PoolPollingBase) {
    // Temporary hack before every pool is ported into new architecture
    if (pool.isUsedForPricing) {
      this.initializeNewPool(identifier, pool);
      return;
    }

    if (
      this.statePollingPoolsFromId[identifier] ||
      this.poolsForOnlyState[identifier]
    ) {
      throw new Error(
        `${this.name}: pool with ${identifier} is already initialized`,
      );
    }
    this.poolsForOnlyState[identifier] = pool;
  }

  getPoolsForPair(
    srcTokenAddress: string,
    destTokenAddress: string,
    isSrcFeeOnTransferToBeExchanged?: boolean,
  ): PoolPollingBase[] {
    const inSrcTokenIdentifiers =
      this.coinAddressesToPoolIdentifiers[srcTokenAddress];
    const inDestTokenIdentifiers =
      this.coinAddressesToPoolIdentifiers[destTokenAddress];

    // I am not sure about this intersection. Maybe better take pool with longer
    // elements and use only that? Because while doing intersection, it still
    // iterates on all elements since we are not using any hashed structure like Set
    let intersectedPoolIdentifiersSubset: string[] = [];
    if (
      inSrcTokenIdentifiers !== undefined &&
      inDestTokenIdentifiers !== undefined
    ) {
      intersectedPoolIdentifiersSubset = _.intersection(
        inSrcTokenIdentifiers,
        inDestTokenIdentifiers,
      );
    }

    const pools = intersectedPoolIdentifiersSubset
      .map(identifier =>
        this.getPool(
          identifier,
          isSrcFeeOnTransferToBeExchanged
            ? isSrcFeeOnTransferToBeExchanged
            : false,
        ),
      )
      .filter((p): p is PoolPollingBase => {
        if (p === null) {
          return false;
        }

        const poolData = p.getPoolData(srcTokenAddress, destTokenAddress);
        if (poolData === null) {
          return false;
        }

        return true;
      });

    return pools;
  }

  getPool(
    identifier: string,
    isSrcFeeOnTransferTokenToBeExchanged: boolean,
  ): PoolPollingBase | null {
    const pool = this.statePollingPoolsFromId[identifier];
    if (pool !== undefined) {
      if (
        isSrcFeeOnTransferTokenToBeExchanged &&
        pool.isSrcFeeOnTransferSupported
      ) {
        return pool;
      } else if (!isSrcFeeOnTransferTokenToBeExchanged) {
        return pool;
      }
    }

    const fromStateOnlyPools = this.poolsForOnlyState[identifier];
    if (fromStateOnlyPools !== undefined) {
      if (
        isSrcFeeOnTransferTokenToBeExchanged &&
        fromStateOnlyPools.isSrcFeeOnTransferSupported
      ) {
        return fromStateOnlyPools;
      } else if (!isSrcFeeOnTransferTokenToBeExchanged) {
        return fromStateOnlyPools;
      }
    }

    return null;
  }

  async fetchLiquiditiesFromApi() {
    let URL: string = '';
    try {
      let someFailed = false;
      const responses = await Promise.all(
        Array.from(Array.from(this.allCurveLiquidityApiSlugs)).map(
          async slug => {
            URL = `${CURVE_API_URL}/${
              NETWORK_ID_TO_NAME[this.dexHelper.config.data.network]
            }${slug}`;

            return this.dexHelper.httpRequest.get<{
              success: boolean;
              data: {
                poolData: {
                  usdTotal: number;
                  address: string;
                  usdTotalExcludingBasePool: number;
                }[];
              };
            }>(URL);
          },
        ),
      );
      const addressToLiquidity: Record<string, number> = {};
      for (const data of responses) {
        if (!data.success) {
          someFailed = true;
          break;
        }
        for (const poolData of data.data.poolData) {
          addressToLiquidity[poolData.address.toLowerCase()] =
            poolData.usdTotal || poolData.usdTotalExcludingBasePool;
        }
      }
      if (someFailed) {
        // This is needed to reduce complexity and don't track when each API was updated. We either update
        // everything or don't update anything and invalidate liquidity amounts
        this.logger.error(
          `${this.name} ${this.dexHelper.config.data.network}: some of the Curve API requests fail. Won't update anything.`,
        );
        return;
      }

      Object.values(this.statePollingPoolsFromId).map(pool => {
        const poolLiquidity = addressToLiquidity[pool.address];
        if (poolLiquidity === undefined) {
          this.logger.error(
            `${this.name}: while updating liquidity in USD for pool, ` +
              `found pool ${pool.address} that is not included in Curve API pools`,
          );
          return;
        }
        pool.liquidityUSD = poolLiquidity;
      });
    } catch (e) {
      this.logger.error(
        `${this.name}: Error fetching liquidity from CurveV2 API ${URL}: `,
        e,
      );
    }
  }

  getPoolsWithToken(tokenAddress: Address): PoolPollingBase[] {
    const poolIdentifiers = this.coinAddressesToPoolIdentifiers[tokenAddress];
    if (poolIdentifiers === undefined) {
      return [];
    }
    return poolIdentifiers
      .map(poolIdentifier => this.getPool(poolIdentifier, false))
      .filter((p): p is PoolPollingBase => p !== null);
  }
}
