import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, BlockHeader } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import { CarbonConfig } from './config';
import _ from 'lodash';
import CarbonControllerABI from '../../abi/carbon/CarbonController.abi.json';
import { EncodedStrategy, EncodedOrder } from './sdk/';
import { ChainCache } from './sdk/chain-cache';
import { BigNumber } from './sdk/utils';

export class CarbonEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
      blockHeader: Readonly<BlockHeader>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  sdkCache: ChainCache;

  public readonly carbonIface = new Interface(CarbonControllerABI);

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, 'Carbon Event Cache', dexHelper, logger);

    // TODO: make logDecoder decode logs that CarbonController emits
    this.logDecoder = (log: Log) => this.carbonIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
      CarbonConfig[parentName][network].carbonController,
    ];

    // Cache that holds all strategy data
    this.sdkCache = new ChainCache();

    // Add handlers
    this.handlers['StrategyCreated'] = this.handleStrategyChanges.bind(this);
    this.handlers['StrategyUpdated'] = this.handleStrategyChanges.bind(this);
    this.handlers['StrategyDeleted'] = this.handleStrategyChanges.bind(this);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    // TODO consider batching events and processing them in one go
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log, blockHeader);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return state;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    // Get list of pairs and strategies from subgraph and add to cache

    const strategiesForAllPairs = `
    query ($block_number: Int) {
      pairs(block: {number: $block_number}, first: 1000, where: {orders_: {y_gt: 0}}) {
        id,
        token0 {
          id
        },
        token1 {
          id
        }
        strategies {
          id,
          order0 {
            y,
            z,
            A,
            B
          },
          order1 {
            y,
            z,
            A,
            B
          }
        }
      }
    }
    `;

    const allStrategiesPerPair = await this._querySubgraph(
      strategiesForAllPairs,
      {
        block_number: blockNumber,
      },
      CarbonConfig[this.parentName][this.network].subgraphURL,
    );

    if (!(allStrategiesPerPair && allStrategiesPerPair.pairs)) {
      this.logger.error(
        `Error_${this.parentName}_Subgraph: couldn't fetch the pools from the subgraph.
         Output: ${allStrategiesPerPair}`,
      );
      return { sdkCache: new ChainCache() };
    }

    const strategiesList = _.map(allStrategiesPerPair.pairs, pair => {
      return {
        id: pair.id.toLowerCase(),
        token0: pair.token0.id.toLowerCase(),
        token1: pair.token1.id.toLowerCase(),
        strategies: _.map(pair.strategies, strategy => {
          return {
            id: strategy.id.toLowerCase(),
            token0: pair.token0.id.toLowerCase(),
            token1: pair.token1.id.toLowerCase(),
            order0: {
              y: BigNumber.from(strategy.order0.y),
              z: BigNumber.from(strategy.order0.z),
              A: BigNumber.from(strategy.order0.A),
              B: BigNumber.from(strategy.order0.B),
            },
            order1: {
              y: BigNumber.from(strategy.order1.y),
              z: BigNumber.from(strategy.order1.z),
              A: BigNumber.from(strategy.order1.A),
              B: BigNumber.from(strategy.order1.B),
            },
          };
        }),
      };
    });

    let newCache = new ChainCache();

    newCache.applyBatchedUpdates(blockNumber, [], [], [], []);

    strategiesList.forEach(pair => {
      newCache.addPair(pair.token0, pair.token1, pair.strategies);
    });

    // Get TradingFeePPM
    const tradingFeeQuery: string = `
    query ($block_number: Int) {
      tradingFeePPMUpdateds(block: {number: $block_number}, first:1, orderBy: createdAtTimestamp, orderDirection: desc) {
        newFeePPM
      }
    }
    `;

    const feeData = await this._querySubgraph(
      tradingFeeQuery,
      {
        block_number: blockNumber,
      },
      CarbonConfig[this.parentName][this.network].subgraphURL,
    );

    if (!(feeData && feeData.tradingFeePPMUpdateds)) {
      this.logger.error(
        `Error_${this.parentName}_Subgraph: couldn't fetch the trading fee from the subgraph`,
      );
      return { sdkCache: new ChainCache() };
    }

    // newCache.tradingFeePPM = feeData.tradingFeePPMUpdateds[0].newFeePPM;

    newCache.tradingFeePPM = 2000;

    return { sdkCache: newCache };
  }

  handleStrategyChanges(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): DeepReadonly<PoolState> | null {
    let encodedOrder0: EncodedOrder = {
      y: BigNumber.from(event.args.order0.y),
      z: BigNumber.from(event.args.order0.z),
      A: BigNumber.from(event.args.order0.A),
      B: BigNumber.from(event.args.order0.B),
    };

    let encodedOrder1: EncodedOrder = {
      y: BigNumber.from(event.args.order1.y),
      z: BigNumber.from(event.args.order1.z),
      A: BigNumber.from(event.args.order1.A),
      B: BigNumber.from(event.args.order1.B),
    };

    let encodedStrategy: EncodedStrategy = {
      id: BigNumber.from(event.args.id),
      token0: event.args.token0.toLowerCase(),
      token1: event.args.token1.toLowerCase(),
      order0: encodedOrder0,
      order1: encodedOrder1,
    };

    if (event.name === 'StrategyCreated') {
      state.sdkCache.applyBatchedUpdates(
        blockHeader.number,
        [],
        [encodedStrategy],
        [],
        [],
      );
    } else if (event.name === 'StrategyUpdated') {
      state.sdkCache.applyBatchedUpdates(
        blockHeader.number,
        [],
        [],
        [encodedStrategy],
        [],
      );
    } else if (event.name === 'StrategyDeleted') {
      state.sdkCache.applyBatchedUpdates(
        blockHeader.number,
        [],
        [],
        [],
        [encodedStrategy],
      );
    }

    return state;
  }

  async _querySubgraph(
    query: string,
    variables: Object,
    subgraphURL: string,
    timeout = 30000,
  ) {
    try {
      const res = await this.dexHelper.httpRequest.post(
        subgraphURL,
        { query, variables },
        undefined,
        { timeout: timeout },
      );
      return res.data;
    } catch (e) {
      this.logger.error(`Can not query subgraph: `, e);
      return {};
    }
  }
}
