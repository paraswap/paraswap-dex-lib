import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError, getBigIntPow } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, PoolConfig } from './types';
import { getOnChainState } from './aave-gsm';
import GsmABI from '../../abi/aave-gsm/gsm.json';

export class AaveGsmEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;
  to18ConversionFactor: bigint;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    protected gsmInterface = new Interface(GsmABI),
  ) {
    super(parentName, poolConfig.identifier, dexHelper, logger);

    this.logDecoder = (log: Log) => this.gsmInterface.parseLog(log);
    this.addressesSubscribed = [poolConfig.gsmAddress];
    this.to18ConversionFactor = getBigIntPow(12);

    // Add handlers
    this.handlers['BuyAsset'] = this.handleBuyAsset.bind(this);
    this.handlers['SellAsset'] = this.handleSellAsset.bind(this);
    this.handlers['SwapFreeze'] = this.handleSwapFreeze.bind(this);
    this.handlers['Seized'] = this.handleSeized.bind(this);
  }

  handleBuyAsset(event: any, pool: PoolState, log: Log): PoolState {
    pool.accruedFees += BigInt(event.args.fee);
    pool.availableUnderlyingLiquidity -= BigInt(event.args.underlyingAmount);
    pool.availableUnderlyingExposure =
      pool.exposureCapUnderlying > pool.availableUnderlyingLiquidity
        ? BigInt(pool.exposureCapUnderlying - pool.availableUnderlyingLiquidity)
        : BigInt(0);
    return pool;
  }

  handleSellAsset(event: any, pool: PoolState, log: Log): PoolState {
    pool.accruedFees += BigInt(event.args.fee);
    pool.availableUnderlyingLiquidity += BigInt(event.args.underlyingAmount);
    pool.availableUnderlyingExposure =
      pool.exposureCapUnderlying > pool.availableUnderlyingLiquidity
        ? BigInt(pool.exposureCapUnderlying - pool.availableUnderlyingLiquidity)
        : BigInt(0);
    return pool;
  }

  handleSwapFreeze(event: any, pool: PoolState, log: Log): PoolState {
    pool.isFrozen = true;
    pool.canSwap = false;
    return pool;
  }

  handleSeized(event: any, pool: PoolState, log: Log): PoolState {
    pool.isSeized = true;
    pool.canSwap = false;
    return pool;
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.poolConfig.gsmAddress}`.toLowerCase();
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
  ): DeepReadonly<PoolState> | null {
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    return (
      await getOnChainState(
        this.dexHelper.multiContract,
        [this.poolConfig],
        blockNumber,
      )
    )[0];
  }

  // Its just a dummy example
  handleMyEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }
}
