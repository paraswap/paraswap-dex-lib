(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import TraderJoeV2_1PoolABI from '../../abi/trader-joe-v2_1/PairABI.json';
import StateMulticallABI from '../../abi/trader-joe-v2_1/StateMulticall.json';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { NULL_ADDRESS } from '../../constants';
import { TraderJoeV21Math } from './math';
import _ from 'lodash';

export class TraderJoeV2_1EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: PoolState,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  public readonly binStep: bigint;

  public initFailed = false;
  public initRetryAttemptCount = 0;
  private stateMulti: Contract;
  private math: TraderJoeV21Math;

  addressesSubscribed: string[];
  poolAddress?: Address;
  token0: Address;
  token1: Address;

  public readonly poolIface = new Interface(TraderJoeV2_1PoolABI);

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    token0: Address,
    token1: Address,
    binStep: bigint,
    private readonly factoryAddress: Address,
    private readonly stateMultiAddress: Address,
    logger: Logger,
  ) {
    super(parentName, `${token0}_${token1}_${binStep}`, dexHelper, logger);

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = Array(1);

    this.binStep = binStep;
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();

    this.stateMulti = new this.dexHelper.web3Provider.eth.Contract(
      StateMulticallABI as AbiItem[],
      stateMultiAddress,
    );
    this.math = new TraderJoeV21Math();

    // Add handlers
    this.handlers['TransferBatch'] = this.handleTransferBatch.bind(this);
    this.handlers['DepositedToBins'] = this.handleDepositedToBins.bind(this);
    this.handlers['WithdrawnFromBins'] =
      this.handleWithdrawnFromBins.bind(this);
    this.handlers['CompositionFees'] = this.handleCompositionFees.bind(this);
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['StaticFeeParametersSet'] =
      this.handleStaticFeeParametersSet.bind(this);
    this.handlers['FlashLoan'] = this.handleFlashLoan.bind(this);
    this.handlers['ForcedDecay'] = this.handleForcedDecay.bind(this);
  }

  getSwapOut(
    amount: bigint,
    fromAddress: Address,
    blockNumber: number,
  ): bigint {
    const state = this.getState(blockNumber);

    if (
      !state ||
      !state.bins ||
      state?.bins?.length === 0 ||
      (state.reserves.reserveX === 0n && state.reserves.reserveY === 0n)
    ) {
      return 0n;
    }

    return this.math.getSwapOut(
      state,
      amount,
      this.binStep,
      state.tokenX === fromAddress,
    );
  }

  getSwapIn(amount: bigint, fromAddress: Address, blockNumber: number): bigint {
    const state = this.getState(blockNumber);

    if (
      !state ||
      !state.bins ||
      state?.bins?.length === 0 ||
      (state.reserves.reserveX === 0n && state.reserves.reserveY === 0n)
    ) {
      return 0n;
    }

    return this.math.getSwapIn(
      state,
      amount,
      this.binStep,
      state.tokenX === fromAddress,
    );
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
        const _state = _.cloneDeep(state) as PoolState;
        return this.handlers[event.name](event, _state, log);
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
    this.logger.log(
      `FFFF ${this.factoryAddress}, ${this.token0}, ${this.token1}, ${this.binStep}`,
    );
    try {
      const stateRaw = await this.stateMulti.methods
        .getFullState(
          this.factoryAddress,
          this.token0,
          this.token1,
          this.binStep,
        )
        .call({}, blockNumber);

      const state = {
        tokenX: stateRaw.tokenX?.toLowerCase(),
        tokenY: stateRaw.tokenY?.toLowerCase(),
        binStep: this.binStep,
        pairAddress: stateRaw.pair,
        bins: stateRaw.bins.map((bin: any) => ({
          id: BigInt(bin.id),
          reserveX: BigInt(bin.reserveX),
          reserveY: BigInt(bin.reserveY),
        })),
        blockTimestamp: BigInt(stateRaw.blockTimestamp),
        reserves: {
          reserveX: BigInt(stateRaw.reserves.reserveX),
          reserveY: BigInt(stateRaw.reserves.reserveY),
        },
        activeId: BigInt(stateRaw.activeId),
        protocolFees: {
          protocolFeeX: BigInt(stateRaw.protocolFees.protocolFeeX),
          protocolFeeY: BigInt(stateRaw.protocolFees.protocolFeeY),
        },
        staticFeeParameters: {
          baseFactor: BigInt(stateRaw.staticFeeParameters.baseFactor),
          filterPeriod: BigInt(stateRaw.staticFeeParameters.filterPeriod),
          decayPeriod: BigInt(stateRaw.staticFeeParameters.decayPeriod),
          reductionFactor: BigInt(stateRaw.staticFeeParameters.reductionFactor),
          variableFeeControl: BigInt(
            stateRaw.staticFeeParameters.variableFeeControl,
          ),
          protocolShare: BigInt(stateRaw.staticFeeParameters.protocolShare),
          maxVolatilityAccumulator: BigInt(
            stateRaw.staticFeeParameters.maxVolatilityAccumulator,
          ),
        },
        variableFeeParameters: {
          volatilityAccumulator: BigInt(
            stateRaw.variableFeeParameters.volatilityAccumulator,
          ),
          volatilityReference: BigInt(
            stateRaw.variableFeeParameters.volatilityReference,
          ),
          idReference: BigInt(stateRaw.variableFeeParameters.idReference),
          timeOfLastUpdate: BigInt(
            stateRaw.variableFeeParameters.timeOfLastUpdate,
          ),
        },
      };
      return state;
    } catch (error) {
      this.logger.error('generateState_ERROR', error);
      return null as any;
    }
  }

  isValid() {
    return (
      this.state?.pairAddress !== NULL_ADDRESS &&
      this.state?.reserves?.reserveX != null &&
      this.state?.reserves?.reserveY != null &&
      this.state.reserves.reserveY > 0n &&
      this.state.reserves.reserveX > 0n
    );
  }

  handleTransferBatch(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleDepositedToBins(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    // console.log('HandlerDepositedEvent.event', event);
    // console.log('HandlerDepositedEvent.log', log);

    for (let i = 0; i < event.args.ids.length; i++) {
      const [amountX, amountY] = this.decodeAmounts(event.args.amounts[i]);
      const bin = state.bins.find(bin => bin.id == BigInt(event.args.ids[i]));
      // console.log(
      //   `bin: ${bin}, amountX: ${amountX}, amountY: ${amountY}, args.id: ${event.args.ids[i]}}`,
      // );
      if (bin) {
        bin.reserveX += amountX;
        bin.reserveY += amountY;
        state.reserves.reserveX += amountX;
        state.reserves.reserveY += amountY;
      }
    }

    // state.blockTimestamp = BigInt(event.args.blockTimestamp);
    return state;
  }

  handleWithdrawnFromBins(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    for (let i = 0; i < event.args.ids.length; i++) {
      const [amountX, amountY] = this.decodeAmounts(event.args.amounts[i]);
      const bin = state.bins.find(bin => bin.id == BigInt(event.args.ids[i]));
      // console.log(
      //   `bin: ${bin}, amountX: ${amountX}, amountY: ${amountY}, args.id: ${event.args.ids[i]}}`,
      // );
      if (bin) {
        bin.reserveX -= amountX;
        bin.reserveY -= amountY;
        state.reserves.reserveX -= amountX;
        state.reserves.reserveY -= amountY;
      }
    }

    // state.blockTimestamp = BigInt(event.args.blockTimestamp);
    return state;
  }

  // TODO: Do we need those at all?
  handleCompositionFees(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    // return null;
    const [protocolFeesDecodedX, protocolFeesDecodedY] = this.decodeAmounts(
      event.args.protocolFees,
    );
    const [totalFeeDecodedX, totalFeeDecodedY] = this.decodeAmounts(
      event.args.totalFees,
    );

    state.protocolFees.protocolFeeX += protocolFeesDecodedX;
    state.protocolFees.protocolFeeY += protocolFeesDecodedY;
    // console.log('protocolFees', event.args.protocolFees);
    // console.log('totalFees', event.args.totalFees);
    // console.log('protocolFeesDecodedX', protocolFeesDecodedX);
    // console.log('protocolFeesDecodedY', protocolFeesDecodedY);
    // console.log('totalFeeDecodedX', totalFeeDecodedX);
    // console.log('totalFeeDecodedY', totalFeeDecodedY);

    return state;
  }

  // TODO: Possibly we need to re-calculate bin reserves from current activeId to id from event
  handleSwap(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    state.variableFeeParameters.volatilityAccumulator =
      event.args.volatilityAccumulator;

    console.log(
      `state.activeId: ${state.activeId}, event.args.id: ${event.args.id}`,
    );
    state.activeId = event.args.id;
    return state;
  }

  handleStaticFeeParametersSet(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    state.staticFeeParameters.baseFactor = BigInt(event.args.baseFactor);
    state.staticFeeParameters.filterPeriod = BigInt(event.args.filterPeriod);
    state.staticFeeParameters.decayPeriod = BigInt(event.args.decayPeriod);
    state.staticFeeParameters.reductionFactor = BigInt(
      event.args.reductionFactor,
    );
    state.staticFeeParameters.variableFeeControl = BigInt(
      event.args.variableFeeControl,
    );
    state.staticFeeParameters.protocolShare = BigInt(event.args.protocolShare);
    state.staticFeeParameters.maxVolatilityAccumulator = BigInt(
      event.args.maxVolatilityAccumulator,
    );

    return state;
  }

  handleFlashLoan(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleForcedDecay(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    state.variableFeeParameters.idReference = BigInt(event.args.idReference);
    state.variableFeeParameters.volatilityReference = BigInt(
      event.args.volatilityReference,
    );
    return state;
  }

  private decodeAmounts(amounts: string): [bigint, bigint] {
    const amountsBigInt = BigInt(amounts);

    // Read the right 128 bits of the 256 bits
    const amountsX = amountsBigInt & (BigInt(2) ** BigInt(128) - BigInt(1));

    // Read the left 128 bits of the 256 bits
    const amountsY = amountsBigInt >> BigInt(128);

    return [amountsX, amountsY];
  }
}
