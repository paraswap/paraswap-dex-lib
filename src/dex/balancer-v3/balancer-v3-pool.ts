import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, PoolStateMap } from './types';
import { getPoolsApi } from './getPoolsApi';
import { vaultExtensionAbi_V3 } from './abi/vaultExtension.V3';
import { getOnChainState } from './getOnChainState';
import { BalancerV3Config } from './config';
import { SwapKind, Vault } from '@balancer-labs/balancer-maths';

export class BalancerV3EventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolStateMap>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolStateMap> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  interfaces: {
    [name: string]: Interface;
  };

  vault: Vault;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(
      parentName,
      BalancerV3Config.BalancerV3[network].vaultAddress,
      dexHelper,
      logger,
    );

    this.interfaces = {
      ['VAULT']: new Interface(vaultExtensionAbi_V3),
      ['STABLE']: new Interface([
        'function getAmplificationParameter() external view returns (uint256 value, bool isUpdating, uint256 precision)',
      ]),
    };

    this.logDecoder = (log: Log) => this.interfaces['VAULT'].parseLog(log);
    this.addressesSubscribed = [
      BalancerV3Config.BalancerV3[network].vaultAddress,
    ];

    // Add handlers
    this.handlers['PoolBalanceChanged'] =
      this.poolBalanceChangedEvent.bind(this);

    // replicates V3 maths with fees, pool and hook logic
    this.vault = new Vault();
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
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
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
    blockNumber: number,
  ): Promise<DeepReadonly<PoolStateMap>> {
    const block = await this.dexHelper.provider.getBlock(blockNumber);
    const apiPoolStateMap = await getPoolsApi(this.network, block.timestamp);
    const allOnChainPools = await getOnChainState(
      this.network,
      apiPoolStateMap,
      this.dexHelper,
      this.interfaces,
      blockNumber,
    );

    // Filter out all pools with hooks and paused pools
    const filteredPools = Object.entries(allOnChainPools)
      .filter(([address, pool]) => {
        return !(pool.hasHook || pool.isPoolPaused);
      })
      .reduce((acc, [address, pool]) => {
        acc[address] = pool;
        return acc;
      }, {} as PoolStateMap);

    return filteredPools;
  }

  async getUpdatedPoolState(
    existingPoolState: DeepReadonly<PoolStateMap>,
  ): Promise<DeepReadonly<PoolStateMap> | null> {
    // Get all latest pools from API
    const apiPoolStateMap = await getPoolsApi(this.network);

    // Filter out pools that already exist in existing state
    const newApiPools = Object.entries(apiPoolStateMap).reduce(
      (acc, [address, pool]) => {
        if (!existingPoolState[address]) {
          acc[address] = pool;
        }
        return acc;
      },
      {} as typeof apiPoolStateMap,
    );

    // If no new pools return
    if (Object.keys(newApiPools).length === 0) {
      return null;
    }

    // Only get on-chain state for new pools
    const newOnChainPools = await getOnChainState(
      this.network,
      newApiPools,
      this.dexHelper,
      this.interfaces,
    );

    // Filter out pools with hooks and paused pools from new state
    // TODO this won't be necessary once API has this filter option
    const filteredNewPools = Object.entries(newOnChainPools)
      .filter(([_, pool]) => !(pool.hasHook || pool.isPoolPaused))
      .reduce((acc, [address, pool]) => {
        acc[address] = pool;
        return acc;
      }, {} as PoolStateMap);

    // Merge existing pools with new pools
    return {
      ...existingPoolState,
      ...filteredNewPools,
    };
  }

  poolBalanceChangedEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from any pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    const newState = _.cloneDeep(state) as PoolStateMap;
    for (
      let i = 0;
      i < newState[poolAddress].balancesLiveScaled18.length;
      i++
    ) {
      newState[poolAddress].balancesLiveScaled18[i] += BigInt(
        event.args.deltas[i],
      );
    }
    return newState;
  }

  getMaxSwapAmount(
    pool: PoolState,
    tokenIn: string,
    tokenOut: string,
    swapKind: SwapKind,
  ): bigint {
    const tokenInIndex = pool.tokens.indexOf(tokenIn);
    const tokenOutIndex = pool.tokens.indexOf(tokenOut);
    // Find the maximum swap amount the pool will support
    const maxSwapAmount = this.vault.getMaxSwapAmount(
      {
        swapKind,
        balancesLiveScaled18: pool.balancesLiveScaled18,
        tokenRates: pool.tokenRates,
        scalingFactors: pool.scalingFactors,
        indexIn: tokenInIndex,
        indexOut: tokenOutIndex,
      },
      pool,
    );
    return maxSwapAmount;
  }

  getSwapResult(
    pool: PoolState,
    amountRaw: bigint,
    tokenIn: string,
    tokenOut: string,
    swapKind: SwapKind,
  ): bigint {
    return this.vault.swap(
      {
        amountRaw,
        tokenIn,
        tokenOut,
        swapKind,
      },
      pool,
    );
  }
}