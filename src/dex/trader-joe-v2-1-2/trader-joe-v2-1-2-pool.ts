import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DecodedStateMultiCallResult, PoolState } from './types';
import TraderJoeV2_1PoolABI from '../../abi/trader-joe-v2_1/PairABI.json';
import { MultiCallParams } from '../../lib/multi-wrapper';
import UniswapMultiABI from '../../abi/uniswap-v3/UniswapMulti.abi.json';
import { Bytes } from 'ethers';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { UniswapV3Config } from '../uniswap-v3/config';
import {
  generalDecoder,
  uint128ToBigNumber,
  uint256ToBigInt,
} from '../../lib/decoders';

export class TraderJoeV2_1EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  public readonly binStep: bigint;

  private contract: Contract;
  private multiState: Contract;

  protected _stateRequestCallData?: MultiCallParams<
    bigint | DecodedStateMultiCallResult
  >[];
  public readonly poolIface = new Interface(TraderJoeV2_1PoolABI);

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    private token0: Address,
    private token1: Address,
    private address: Address,
    private readonly multiStateAddress: Address,
    binStep: bigint,
    logger: Logger,
  ) {
    // TODO: Add pool name
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
    this.token0 = token0;
    this.token1 = token1;

    this.multiState = new this.dexHelper.web3Provider.eth.Contract(
      UniswapMultiABI as AbiItem[],
      UniswapV3Config['UniswapV3'][network].uniswapMulticall,
    );
    this.contract = new Contract(TraderJoeV2_1PoolABI as AbiItem[], address);

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

  getSwapOut() {}

  getSwapIn() {}

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
    // const params = [false, 0];
    // const result = await this.uniswapMulti.methods
    //   .getReserves(this.addressesSubscribed[0])
    //   .call({}, blockNumber);
    // // TODO: complete me!
    return {} as any;
  }

  protected _getStateRequestCallData() {
    if (!this._stateRequestCallData) {
      // const callData: MultiCallParams<bigint | bigint[]>[] = [
      const callData: MultiCallParams<any>[] = [
        {
          target: this.addressesSubscribed[0],
          callData: this.poolIface.encodeFunctionData('getReserves', []),
          decodeFunction: (result: any) => {
            return generalDecoder(
              result,
              ['uint128', 'uint128'],
              [0n, 0n],
              value => [value[0].toBigInt(), value[1].toBigInt()],
            );
          },
        },
        {
          target: this.addressesSubscribed[0],
          callData: this.poolIface.encodeFunctionData('getActiveId', []),
          decodeFunction: uint128ToBigNumber,
        },
      ];
      // const callData: MultiCallParams<
      //   bigint | DecodedStateMultiCallResultWithRelativeBitmaps
      // >[] = [
      //   {
      //     target: this.token0,
      //     callData: this.erc20Interface.encodeFunctionData('balanceOf', [
      //       this.poolAddress,
      //     ]),
      // decodeFunction: uint256ToBigInt,
      //   },
      //   {
      //     target: this.token1,
      //     callData: this.erc20Interface.encodeFunctionData('balanceOf', [
      //       this.poolAddress,
      //     ]),
      //     decodeFunction: uint256ToBigInt,
      //   },
      //   {
      //     target: this.stateMultiContract.options.address,
      //     callData: this.stateMultiContract.methods
      //       .getFullStateWithRelativeBitmaps(
      //         this.factoryAddress,
      //         this.token0,
      //         this.token1,
      //         this.feeCode,
      //         this.getBitmapRangeToRequest(),
      //         this.getBitmapRangeToRequest(),
      //       )
      //       .encodeABI(),
      //     decodeFunction:
      //       this.decodeStateMultiCallResultWithRelativeBitmaps !== undefined
      //         ? this.decodeStateMultiCallResultWithRelativeBitmaps
      //         : decodeStateMultiCallResultWithRelativeBitmaps,
      //   },
      // ];

      this._stateRequestCallData = callData;
    }
    return this._stateRequestCallData;
  }

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
