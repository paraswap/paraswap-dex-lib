import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DecodedStateMultiCallResult, PoolState } from './types';
import TraderJoeV2_1PoolABI from '../../abi/trader-joe-v2_1/PairABI.json';
import StateMulticallABI from '../../abi/trader-joe-v2_1/StateMulticall.json';
import { Bytes } from 'ethers';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import {
  generalDecoder,
  uint128ToBigNumber,
  uint256ToBigInt,
} from '../../lib/decoders';
import { NULL_ADDRESS } from '../../constants';
import { BASIS_POINT_MAX, PRECISION, SCALE_OFFSET } from './constants';
// import { TraderJoeV21Math } from './mathv2';
import { TraderJoeV21Math } from './math';

export class TraderJoeV2_1EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
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
    super(
      parentName,
      `${token0}_${token1}_${binStep}`,
      dexHelper,
      logger,
      // true,
      // mapKey,
    );

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
    // this.contract = new Contract(TraderJoeV2_1PoolABI as AbiItem[], address);

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

  getSwapOut(amount: bigint, swapForY: boolean, blockNumber: number): bigint {
    const state = this.getState(blockNumber);

    if (
      !state ||
      !state.bins ||
      state?.bins?.length === 0 ||
      (state.reserves.reserveX === 0n && state.reserves.reserveY === 0n)
    ) {
      return 0n;
    }

    return this.math.getSwapOut(state, amount, this.binStep, swapForY);

    // let amountOut = 0n;
    // // decrement until we fill the order, order is filled if amountsInLeft = 0;
    // // if amountInLeft > 0, then we only have the liquidity to fill amountIn - amountInLeft
    // let amountsInLeft = amount;

    // let i = state.bins.findIndex(bin => bin.id === state.activeId);
    // for (; i < state.bins.length; i++) {
    //   const bin = state.bins[i];
    //   const binReserves = swapForY ? bin.reserveY : bin.reserveX;
    //   if (binReserves >= 0n) {
    //     const [amountsInWithFees, amountsOutOfBin, totalFees] =
    //       this.getAmountsFromReserves(bin.id, amountsInLeft, binReserves);
    //   }
    //   if (amountsInLeft == 0n) {
    //     break;
    //   }
    // }
    // return amountOut;
  }

  getSwapIn(amount: bigint, swapForY: boolean, blockNumber: number): bigint {
    return 1n;
  }

  // MATH

  // getPriceFromId(id: bigint) {
  //   const base = 1n + this.binStep / BASIS_POINT_MAX;
  //   const exponent = id - BigInt(1 << 23);

  //   return base ** exponent;
  // }

  // getAmountsFromReserves(
  //   binId: bigint,
  //   amountInLeft: bigint,
  //   binReserves: bigint,
  // ): [bigint, bigint, bigint] {
  //   const result = [0n, 0n, 0n] as [bigint, bigint, bigint];
  //   const price = this.getPriceFromId(binId);

  //   // TODO: Not 1:1 mapping
  //   let maxAmountIn = binReserves << (SCALE_OFFSET / price);
  //   const totalFee = this.getBaseFee() + this.getVariableFee();
  //   const maxFee = this.getFeeAmount(maxAmountIn, totalFee);

  //   maxAmountIn += maxFee;
  //   let amountIn = amountInLeft;
  //   let fee: bigint;
  //   let amountOut: bigint;

  //   if (amountInLeft >= maxAmountIn) {
  //     fee = maxFee;
  //     amountIn = maxAmountIn;
  //     amountOut = binReserves;
  //   } else {
  //     fee = this.getFeeAmountFrom(amountInLeft, totalFee);
  //     // TODO: Implement
  //     amountOut = 0n;
  //   }
  //   result[0] = amountIn;
  //   result[1] = amountOut;
  //   result[2] = fee;
  //   return result;
  // }

  // getBaseFee() {
  //   return (
  //     this.state?.staticFeeParameters?.baseFactor! * this.binStep * BigInt(1e10)
  //   );
  // }

  // getVariableFee() {
  //   const variableFeeControl =
  //     this.state?.staticFeeParameters?.variableFeeControl!;
  //   if (variableFeeControl === 0n) {
  //     return 0n;
  //   }
  //   const prod =
  //     this.state?.variableFeeParameters?.volatilityAccumulator! * this.binStep;
  //   const variableFee = (prod * prod * variableFeeControl + 99n) / 100n;
  //   return variableFee;
  // }

  // getFeeAmount(maxAmountIn: bigint, totalFee: bigint) {
  //   const denominator = PRECISION - totalFee;
  //   return (maxAmountIn * totalFee + denominator - 1n) / denominator;
  // }

  // getFeeAmountFrom(amountInWithFees: bigint, totalFee: bigint) {
  //   return amountInWithFees * totalFee + PRECISION - 1n / PRECISION;
  // }

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
      // this.logger.log('GEN_S_STATE', JSON.stringify(stateRaw, null, 2));
      this.logger.log('GEN_S_STATE', stateRaw, null, 2);
      const state = {
        tokenX: this.token0,
        tokenY: this.token1,
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
      this.logger.info('STATE_PARSED', state);
      return state;
    } catch (error) {
      this.logger.error('ERRRR', error);
      return null as any;
    }
  }

  isValid() {
    return (
      this.state?.pairAddress !== NULL_ADDRESS &&
      this.state?.reserves?.reserveX != null &&
      this.state?.reserves?.reserveY != null &&
      this.state?.reserves?.reserveY > 0n &&
      this.state?.reserves?.reserveX > 0n
    );
  }
  // protected _getStateRequestCallData() {
  //   if (!this._stateRequestCallData) {
  //     // const callData: MultiCallParams<bigint | bigint[]>[] = [
  //     const callData: MultiCallParams<any>[] = [
  //       {
  //         target: this.addressesSubscribed[0],
  //         callData: this.poolIface.encodeFunctionData('getReserves', []),
  //         decodeFunction: (result: any) => {
  //           return generalDecoder(
  //             result,
  //             ['uint128', 'uint128'],
  //             [0n, 0n],
  //             value => [value[0].toBigInt(), value[1].toBigInt()],
  //           );
  //         },
  //       },
  //       {
  //         target: this.addressesSubscribed[0],
  //         callData: this.poolIface.encodeFunctionData('getActiveId', []),
  //         decodeFunction: uint128ToBigNumber,
  //       },
  //     ];

  //     this._stateRequestCallData = callData;
  //   }
  //   return this._stateRequestCallData;
  // }

  handleTransferBatch(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleDepositedToBins(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleWithdrawnFromBins(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleCompositionFees(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleSwap(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleStaticFeeParametersSet(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleFlashLoan(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleForcedDecay(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  // private decodeAmounts(amounts: Bytes): [bigint, bigint] {
  private decodeAmounts(amounts: number[]): [bigint, bigint] {
    /**
     * Decodes the amounts bytes input as 2 integers.
     *
     * @param amounts - amounts to decode.
     * @return tuple of BigInts with the values decoded.
     */

    // Convert amounts to a BigInt
    const amountsBigInt = BigInt(`0x${Buffer.from(amounts).toString('hex')}`);

    // Read the right 128 bits of the 256 bits
    const amountsX = amountsBigInt & (BigInt(2) ** BigInt(128) - BigInt(1));

    // Read the left 128 bits of the 256 bits
    const amountsY = amountsBigInt >> BigInt(128);

    return [amountsX, amountsY];
  }

  // private decodeFees(feesBytes: Bytes): bigint {
  private decodeFees(feesBytes: number[]): bigint {
    /**
     * Decode the fee value from the bytes input and return it as in integer.
     * Fee values are stored in the first 128 bits of the input.
     *
     * @param feesBytes - Bytes containing the encoded value.
     * @return Fee values.
     */

    // Convert feesBytes to a BigInt
    const feesBigInt = BigInt(`0x${Buffer.from(feesBytes).toString('hex')}`);

    // Retrieve the fee value from the right 128 bits
    return feesBigInt & (BigInt(2) ** BigInt(128) - BigInt(1));
  }
}
