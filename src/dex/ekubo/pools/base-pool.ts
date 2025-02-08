import { Interface, LogDescription } from '@ethersproject/abi';
import { DeepReadonly, DeepWritable } from 'ts-essentials';
import { Log, Logger } from '../../../types';
import { catchParseLogError } from '../../../utils';
import { StatefulEventSubscriber } from '../../../stateful-event-subscriber';
import { IDexHelper } from '../../../dex-helper/idex-helper';
import { PoolKey, PoolState as PoolState, Tick } from '../types';
import CoreABI from '../../../abi/ekubo/core.json';
import { Contract } from 'ethers';
import _ from 'lodash';
import { computeStep, isPriceIncreasing } from './math/swap';
import {
  approximateNumberOfTickSpacingsCrossed,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  toSqrtRatio,
} from './math/tick';

export interface Quote {
  consumedAmount: bigint;
  calculatedAmount: bigint;
  gasConsumed: number;
}

const BASE_GAS_COST_OF_ONE_SWAP = 90_000;
const GAS_COST_OF_ONE_INITIALIZED_TICK_CROSSED = 20_000;
const GAS_COST_OF_ONE_TICK_SPACING_CROSSED = 2_000;

/**
 * Ekubo uses a singleton architecture, meaning that most pool events are emitted by one contract.
 * To avoid registering handlers with the same filter for every pool, we handle all events in this subscriber
 * and delegate the events to the pool implementations.
 */
export class BasePool extends StatefulEventSubscriber<PoolState.Object> {
  handlers: {
    [event: string]: (
      event: LogDescription,
      state: DeepReadonly<PoolState.Object>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState.Object> | null;
  } = {};

  public readonly addressesSubscribed: string[];

  private readonly id: bigint;

  constructor(
    public readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    private readonly core: Contract,
    private readonly coreIface: Interface,
    private readonly dataFetcher: Contract,
    public readonly key: PoolKey,
  ) {
    super(parentName, key.stringId(), dexHelper, logger);

    this.addressesSubscribed = [core.address];

    this.handlers['Swapped'] = this.handleSwappedEvent.bind(this);
    this.handlers['PositionUpdated'] =
      this.handlePositionUpdatedEvent.bind(this);

    this.id = this.key.intId();
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
    state: DeepReadonly<PoolState.Object>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState.Object> | null {
    try {
      const event = this.coreIface.parseLog(log);
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
  ): Promise<DeepReadonly<PoolState.Object>> {
    const data = await this.dataFetcher.getQuoteData([this.key.toAbi()], 10, {
      blockTag: blockNumber,
    });
    return PoolState.fromQuoter(data[0]);
  }

  handleSwappedEvent(
    event: LogDescription,
    oldState: DeepReadonly<PoolState.Object>,
    _log: Readonly<Log>,
  ): DeepReadonly<PoolState.Object> | null {
    const args = event.args;
    const poolKey = poolKeyFromEventArgs(args.poolKey);

    if (!_.isEqual(this.key, poolKey)) {
      return null;
    }

    return PoolState.fromSwappedEvent(
      oldState,
      args.sqrtRatioAfter,
      args.liquidityAfter,
      args.tickAfter,
    );
  }

  handlePositionUpdatedEvent(
    event: LogDescription,
    oldState: DeepReadonly<PoolState.Object>,
    _log: Readonly<Log>,
  ): DeepReadonly<PoolState.Object> | null {
    const args = event.args;
    const poolKey = poolKeyFromEventArgs(args.poolKey);

    if (!_.isEqual(this.key, poolKey)) {
      return null;
    }

    const params = args.params;

    return PoolState.fromPositionUpdatedEvent(
      oldState,
      [params.bounds.lower, params.bounds.upper],
      params.liquidityDelta.toBigInt(),
    );
  }

  public quote(amount: bigint, token: bigint, blockNumber: number): Quote {
    const isToken1 = token === this.key.token1;

    if (!isToken1 && this.key.token0 !== token) {
      throw new Error('Invalid token');
    }

    if (amount === 0n) {
      return {
        consumedAmount: 0n,
        calculatedAmount: 0n,
        gasConsumed: 0,
      };
    }

    const isIncreasing = isPriceIncreasing(amount, isToken1);

    let state = this.getState(blockNumber);
    if (state === null) {
      throw new Error(
        `Quote for block number ${blockNumber} requested but state is not recent enough`,
      );
    }

    let { sqrtRatio, liquidity, activeTickIndex, sortedTicks } = state;

    const sqrtRatioLimit = isIncreasing ? MAX_SQRT_RATIO : MIN_SQRT_RATIO;

    let calculatedAmount = 0n;
    let initializedTicksCrossed = 0;
    let amountRemaining = amount;

    const startingSqrtRatio = sqrtRatio;

    while (amountRemaining !== 0n && sqrtRatio !== sqrtRatioLimit) {
      const nextInitializedTick =
        (isIncreasing
          ? sortedTicks[activeTickIndex + 1]
          : sortedTicks[activeTickIndex]) ?? null;

      const nextInitializedTickSqrtRatio = nextInitializedTick
        ? toSqrtRatio(nextInitializedTick.number)
        : null;

      const stepSqrtRatioLimit =
        nextInitializedTickSqrtRatio === null
          ? sqrtRatioLimit
          : nextInitializedTickSqrtRatio < sqrtRatioLimit === isIncreasing
          ? nextInitializedTickSqrtRatio
          : sqrtRatioLimit;

      const step = computeStep({
        fee: this.key.fee,
        sqrtRatio,
        liquidity,
        isToken1,
        sqrtRatioLimit: stepSqrtRatioLimit,
        amount: amountRemaining,
      });

      amountRemaining -= step.consumedAmount;
      calculatedAmount += step.calculatedAmount;
      sqrtRatio = step.sqrtRatioNext;

      // cross the tick if the price moved all the way to the next initialized tick price
      if (nextInitializedTick && sqrtRatio === nextInitializedTickSqrtRatio) {
        activeTickIndex = isIncreasing
          ? activeTickIndex + 1
          : activeTickIndex - 1;
        initializedTicksCrossed++;
        liquidity += isIncreasing
          ? nextInitializedTick.liquidityDelta
          : -nextInitializedTick.liquidityDelta;
      }
    }

    return {
      consumedAmount: amount - amountRemaining,
      calculatedAmount,
      gasConsumed:
        BASE_GAS_COST_OF_ONE_SWAP +
        initializedTicksCrossed * GAS_COST_OF_ONE_INITIALIZED_TICK_CROSSED +
        approximateNumberOfTickSpacingsCrossed(
          startingSqrtRatio,
          sqrtRatio,
          this.key.tickSpacing,
        ) *
          GAS_COST_OF_ONE_TICK_SPACING_CROSSED,
    };
  }
}

function poolKeyFromEventArgs(args: any): PoolKey {
  return new PoolKey(
    BigInt(args.token0),
    BigInt(args.token1),
    args.fee.toBigInt(),
    args.tickSpacing,
    BigInt(args.extension),
  );
}
