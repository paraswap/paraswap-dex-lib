import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import ResolverABI from '../../abi/fluid-dex/resolver.abi.json';
import DexFactoryABI from '../../abi/fluid-dex/liquidityUserModule.abi.json';
import {
  commonAddresses,
  FluidDexPool,
  FluidDexPoolState,
  PoolWithReserves,
  Pool,
} from './types';
import { ethers } from 'ethers';
import { eachOfSeries } from 'async';
import { MultiResult, MultiCallParams } from '../../lib/multi-wrapper';
import { BytesLike } from 'ethers/lib/utils';
import { Address } from '../../types';
import { generalDecoder, extractSuccessAndValue } from '../../lib/decoders';

export class FluidDexCommonAddresses extends StatefulEventSubscriber<Pool[]> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<Pool[]>,
      log: Readonly<Log>,
    ) => Promise<DeepReadonly<Pool[]> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: Address[];
  protected dexFactoryIface = new Interface(DexFactoryABI);

  constructor(
    readonly parentName: string,
    // readonly pool: FluidDexPool,
    readonly commonAddresses: commonAddresses,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, 'getAllPools', dexHelper, logger);

    this.logDecoder = (log: Log) => this.dexFactoryIface.parseLog(log);
    this.addressesSubscribed = [commonAddresses.dexFactory];

    // Add handlers
    this.handlers['DexDeployed'] = this.handleDexDeployed.bind(this);
  }

  /**
   * Handle a trade rate change on the pool.
   */
  async handleDexDeployed(
    event: any,
    state: DeepReadonly<Pool[]>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<Pool[]> | null> {
    const resolverAbi = new Interface(ResolverABI);
    const callData: MultiCallParams<Pool>[] = [
      {
        target: this.commonAddresses.resolver,
        callData: resolverAbi.encodeFunctionData('getPool', [event.args.dexId]),
        decodeFunction: await this.decodePool,
      },
    ];

    const results: Pool[] = await this.dexHelper.multiWrapper.aggregate<Pool>(
      callData,
      await this.dexHelper.provider.getBlockNumber(),
      this.dexHelper.multiWrapper.defaultBatchSize,
    );

    const generatedPool = {
      address: results[0].address,
      token0: results[0].token0,
      token1: results[0].token1,
    };

    let currentPool = this.getState(0);
    currentPool = currentPool == null ? [] : currentPool;
    currentPool = [...currentPool, generatedPool];

    this.setState(currentPool, await this.dexHelper.provider.getBlockNumber());

    return currentPool;
  }

  decodePool = (result: MultiResult<BytesLike> | BytesLike): Pool => {
    return generalDecoder(
      result,
      ['tuple(address pool, address token0, address token1, uint256 fee)'],
      undefined,
      decoded => {
        return {
          address: decoded[0].toLowerCase(),
          token0: decoded[1].toLowerCase(),
          token1: decoded[2].toLowerCase(),
        };
      },
    );
  };

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  async processLog(
    state: DeepReadonly<Pool[]>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<Pool[]> | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  async getStateOrGenerate(
    blockNumber: number,
    readonly: boolean = false,
  ): Promise<DeepReadonly<Pool[]>> {
    let state = this.getState(blockNumber);
    if (!state) {
      state = await this.generateState(blockNumber);
      if (!readonly) this.setState(state, blockNumber);
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
  async generateState(blockNumber: number): Promise<DeepReadonly<Pool[]>> {
    // Flatten the array of arrays into a single array
    const flattenedResults: Pool[] = (
      await this.getPoolsFromResolver(blockNumber)
    ).flat();

    // Cast the result to DeepReadonly<Pool[]>
    return flattenedResults as DeepReadonly<Pool[]>;
  }

  async getPoolsFromResolver(blockNumber: number): Promise<Pool[]> {
    const resolverAbi = new Interface(ResolverABI);
    const callData: MultiCallParams<Pool[]>[] = [
      {
        target: this.commonAddresses.resolver,
        callData: resolverAbi.encodeFunctionData('getAllPools', []),
        decodeFunction: this.decodePools,
      },
    ];

    const results: Pool[][] = await this.dexHelper.multiWrapper.aggregate<
      Pool[]
    >(callData, blockNumber, this.dexHelper.multiWrapper.defaultBatchSize);

    return results[0];
  }

  decodePools = (result: MultiResult<BytesLike> | BytesLike): Pool[] => {
    return generalDecoder(
      result,
      ['tuple(address pool, address token0, address token1)[]'],
      undefined,
      decoded => {
        return decoded.map((decodedPool: any) => ({
          address: decodedPool[0][0].toLowerCase(),
          token0: decodedPool[0][1].toLowerCase(),
          token1: decodedPool[0][2].toLowerCase(),
        }));
      },
    );
  };
}
