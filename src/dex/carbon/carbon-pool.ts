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
import { Contract } from 'web3-eth-contract';

export class CarbonEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: PoolState,
      log: Readonly<Log>,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  carbonController: Contract;

  public readonly carbonIface = new Interface(CarbonControllerABI);

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(
      parentName,
      CarbonConfig[parentName][network].carbonController,
      dexHelper,
      logger,
    );

    this.logDecoder = (log: Log) => this.carbonIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
      CarbonConfig[parentName][network].carbonController,
    ];

    this.carbonController = new this.dexHelper.web3Provider.eth.Contract(
      CarbonControllerABI as any,
      CarbonConfig[parentName][network].carbonController,
    );

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
  ): PoolState | null {
    try {
      let _state = _.cloneDeep(state) as PoolState;
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        _state = _.cloneDeep(
          this.handlers[event.name](event, _state, log, blockHeader),
        );
        return _state;
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
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
  async generateState(
    blockNumber: number | 'latest',
  ): Promise<DeepReadonly<PoolState>> {
    // Get list of pairs and strategies from subgraph and add to cache
    if (blockNumber === 'latest' || blockNumber === undefined) {
      blockNumber = await this.dexHelper.provider.getBlockNumber();
    }

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
          owner {
            id
          },
          order0 {
            outputToken {
              id
            },
            y,
            z,
            A,
            B
          },
          order1 {
            outputToken {
              id
            },
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
    }

    const strategiesList = _.map(allStrategiesPerPair.pairs, pair => {
      return {
        id: pair.id,
        token0: pair.token0.id.toLowerCase(),
        token1: pair.token1.id.toLowerCase(),
        strategies: _.map(pair.strategies, strategy => {
          return {
            id: strategy.id,
            owner: strategy.owner.id.toLowerCase(),
            token0: strategy.order0.outputToken.id.toLowerCase(),
            token1: strategy.order1.outputToken.id.toLowerCase(),
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

    const newCache = new ChainCache();

    strategiesList.forEach(pair => {
      newCache.addPair(pair.token0, pair.token1, pair.strategies, true);
    });

    newCache.applyBatchedUpdates(blockNumber, [], [], [], []);

    newCache.tradingFeePPM = await this.carbonController.methods
      .tradingFeePPM()
      .call();

    const newState: PoolState = {
      sdkCache: newCache,
    };

    this.setState(newState, blockNumber);

    return newState;
  }

  handleStrategyChanges(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): PoolState {
    const encodedOrder0: EncodedOrder = {
      y: BigNumber.from(event.args.order0.y),
      z: BigNumber.from(event.args.order0.z),
      A: BigNumber.from(event.args.order0.A),
      B: BigNumber.from(event.args.order0.B),
    };

    const encodedOrder1: EncodedOrder = {
      y: BigNumber.from(event.args.order1.y),
      z: BigNumber.from(event.args.order1.z),
      A: BigNumber.from(event.args.order1.A),
      B: BigNumber.from(event.args.order1.B),
    };

    const encodedStrategy: EncodedStrategy = {
      id: BigNumber.from(event.args.id),
      token0: event.args.token0.toLowerCase(),
      token1: event.args.token1.toLowerCase(),
      order0: encodedOrder0,
      order1: encodedOrder1,
    };

    this.logger.info(
      `Updating with event ${event.name} at block ${blockHeader.number}`,
    );

    if (event.name === 'StrategyCreated') {
      if (
        !state.sdkCache.hasCachedPair(
          encodedStrategy.token0,
          encodedStrategy.token1,
        )
      ) {
        state.sdkCache.addPair(encodedStrategy.token0, encodedStrategy.token1, [
          encodedStrategy,
        ]);
      } else {
        state.sdkCache.applyBatchedUpdates(
          blockHeader.number,
          [],
          [encodedStrategy],
          [],
          [],
        );
      }
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

    return { sdkCache: state.sdkCache };
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
