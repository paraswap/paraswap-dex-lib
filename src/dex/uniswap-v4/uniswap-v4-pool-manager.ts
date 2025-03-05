import {
  InitializeStateOptions,
  StatefulEventSubscriber,
} from '../../stateful-event-subscriber';
import { PoolManagerState } from './types';
import { Log, Logger } from '../../types';
import { IDexHelper } from '../../dex-helper';
import { Contract } from 'web3-eth-contract';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { BlockHeader } from 'web3-eth';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { uint256ToBigInt } from '../../lib/decoders';
import UniswapV4StateViewABI from '../../abi/uniswap-v4/state-view.abi.json';
import { BytesLike, Interface } from 'ethers/lib/utils';
import { DecodedStateMultiCallResultWithRelativeBitmaps } from '../uniswap-v3/types';

export class UniswapV4PoolManager extends StatefulEventSubscriber<PoolManagerState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolManagerState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolManagerState;
  } = {};

  logDecoder: (log: Log) => any;

  stateViewIface: Interface;

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    readonly stateMultiContract: Contract,
    private readonly poolManagerAddress: string,
    private readonly stateViewAddress: string,
    logger: Logger,
  ) {
    super(parentName, '', dexHelper, logger, true, '');

    this.stateViewIface = new Interface(UniswapV4StateViewABI);
    this.addressesSubscribed = [poolManagerAddress];

    // Add handlers
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Donate'] = this.handleDonateEvent.bind(this);
    this.handlers['Initialize'] = this.handleInitializeEvent.bind(this);
    this.handlers['ModifyLiquidity'] =
      this.handleModifyLiquidityEvent.bind(this);
  }

  async initialize(
    blockNumber: number,
    options?: InitializeStateOptions<PoolManagerState>,
  ) {
    await super.initialize(blockNumber, options);
  }

  protected processLog(
    state: DeepReadonly<PoolManagerState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): AsyncOrSync<DeepReadonly<PoolManagerState> | null> {
    return null;
  }

  _getStateRequestCallData() {
    const callData: MultiCallParams<bigint | any>[] = [
      {
        target: this.stateViewAddress,
        callData: this.stateViewIface.encodeFunctionData('getSlot0', []),
        decodeFunction: (result: BytesLike) =>
          this.stateViewIface.decodeFunctionResult('getSlot1', result),
      },
      {
        target: this.stateViewAddress,
        callData: this.stateViewIface.encodeFunctionData('getLiquidity', []),
        decodeFunction: (result: BytesLike) =>
          this.stateViewIface.decodeFunctionResult('getLiquidity', result),
      },
    ];

    return callData;
  }

  async generateState(
    blockNumber: number,
  ): Promise<Readonly<PoolManagerState>> {
    const callData = this._getStateRequestCallData();

    const [slot0, liquidity] = await this.dexHelper.multiWrapper.tryAggregate<
      bigint | DecodedStateMultiCallResultWithRelativeBitmaps
    >(
      false,
      callData,
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );
  }

  handleSwapEvent(
    event: any,
    pool: PoolManagerState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    return pool;
  }

  handleDonateEvent(
    event: any,
    pool: PoolManagerState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    return pool;
  }

  handleInitializeEvent(
    event: any,
    pool: PoolManagerState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    return pool;
  }

  handleModifyLiquidityEvent(
    event: any,
    pool: PoolManagerState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    return pool;
  }
}
