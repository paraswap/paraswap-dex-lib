import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, BlockHeader, Log, Logger, Token } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import MaverickV2PoolABI from '../../abi/maverick-v2/MaverickV2Pool.json';
import MaverickV2PoolLensABI from '../../abi/maverick-v2/MaverickV2PoolLens.json';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { MaverickPoolMath } from './maverick-math/maverick-pool-math';
import _ from 'lodash';

export class MaverickV2EventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
      blockHeader: BlockHeader,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  poolContract: Contract;
  poolLensContract: Contract;

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  poolMath: MaverickPoolMath;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public tokenA: Token,
    public tokenB: Token,
    public feeAIn: bigint,
    public feeBIn: bigint,
    public tickSpacing: bigint,
    public protocolFeeRatio: bigint,
    public lookback: bigint,
    public activeTick: bigint,
    public address: Address,
    public poolLensAddress: Address,
    protected maverickV2Iface = new Interface(MaverickV2PoolABI),
  ) {
    const name = `${parentName.toLowerCase()}-${tokenA.symbol}-${
      tokenB.symbol
    }-${address.toLowerCase()}`;

    super(parentName, name, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.maverickV2Iface.parseLog(log);
    this.addressesSubscribed = [address];

    // Add handlers
    this.handlers['PoolAddLiquidity'] = this.handleAddLiquidityEvent.bind(this);
    this.handlers['PoolRemoveLiquidity'] =
      this.handleRemoveLiquidityEvent.bind(this);
    this.handlers['PoolSwap'] = this.handleSwapEvent.bind(this);

    this.poolMath = new MaverickPoolMath(
      feeAIn,
      feeBIn,
      lookback,
      tickSpacing,
      protocolFeeRatio,
      activeTick,
      BigInt(tokenA.decimals),
      BigInt(tokenB.decimals),
    );

    this.poolContract = new this.dexHelper.web3Provider.eth.Contract(
      MaverickV2PoolABI as AbiItem[],
      this.address,
    );

    this.poolLensContract = new this.dexHelper.web3Provider.eth.Contract(
      MaverickV2PoolLensABI as AbiItem[],
      this.poolLensAddress,
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
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log, blockHeader);
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
    try {
      const poolContractState = await this.poolContract.methods
        .getState()
        .call({}, blockNumber);

      const poolState: PoolState = {
        activeTick: BigInt(poolContractState.activeTick),
        binCounter: BigInt(poolContractState.binCounter),
        reserveA: BigInt(poolContractState.reserveA),
        reserveB: BigInt(poolContractState.reserveB),
        lastTwaD8: BigInt(poolContractState.lastTwaD8),
        lastLogPriceD8: BigInt(poolContractState.lastLogPriceD8),
        lastTimestamp: BigInt(poolContractState.lastTimestamp),
        bins: {},
        ticks: {},
      };

      for (let i = 0n; i < poolState.binCounter / 5000n + 1n; i++) {
        const poolLensState = await this.poolLensContract.methods[
          'getFullPoolState'
        ](this.address, i * 5000n, (i + 1n) * 5000n).call({}, blockNumber);

        poolLensState.binStateMapping.forEach((bin: any, i: number) => {
          if (i === 0) return;
          const tick = poolLensState.tickStateMapping[i];
          poolState.bins[i.toString()] = {
            mergeBinBalance: BigInt(bin.mergeBinBalance),
            mergeId: BigInt(bin.mergeId),
            totalSupply: BigInt(bin.totalSupply),
            kind: BigInt(bin.kind),
            tick: BigInt(bin.tick),
            tickBalance: BigInt(bin.tickBalance),
          };
          poolState.ticks[bin.tick.toString()] = {
            reserveA: BigInt(tick.reserveA),
            reserveB: BigInt(tick.reserveB),
            totalSupply: BigInt(tick.totalSupply),
            binIdsByTick: {},
          };
          tick.binIdsByTick.forEach((id: any, i: number) => {
            if (id != 0n) {
              poolState.ticks[bin.tick.toString()].binIdsByTick[i.toString()] =
                BigInt(id);
            }
          });
        });
      }
      return poolState;
    } catch {
      return {
        activeTick: BigInt(0),
        binCounter: BigInt(0),
        reserveA: BigInt(0),
        reserveB: BigInt(0),
        lastTwaD8: BigInt(0),
        lastLogPriceD8: BigInt(0),
        lastTimestamp: BigInt(0),
        bins: {},
        ticks: {},
      };
    }
  }

  handleRemoveLiquidityEvent(
    event: any,
    state: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const blockTimestamp = BigInt(blockHeader.timestamp);
    this.poolMath.removeLiquidity(state, blockTimestamp, {
      binIds: event.args.params.binIds.map((id: any) => BigInt(id)),
      amounts: event.args.params.amounts.map((amount: any) => BigInt(amount)),
    });
    return state;
  }

  handleAddLiquidityEvent(
    event: any,
    state: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const blockTimestamp = BigInt(blockHeader.timestamp);
    this.poolMath.addLiquidity(state, blockTimestamp, {
      ticks: event.args.params.ticks.map((amount: any) => BigInt(amount)),
      amounts: event.args.params.amounts.map((amount: any) => BigInt(amount)),
      kind: BigInt(event.args.params.kind),
    });
    return state;
  }

  handleSwapEvent(
    event: any,
    state: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const blockTimestamp = BigInt(blockHeader.timestamp);
    this.poolMath.swap(
      state,
      blockTimestamp,
      BigInt(event.args.params.amount),
      event.args.params.tokenAIn,
      event.args.params.exactOutput,
      event.args.params.tickLimit,
    );
    return state;
  }

  swap(
    amount: bigint,
    from: Token,
    to: Token,
    side: boolean,
  ): [bigint, bigint] {
    try {
      const tempState = _.cloneDeep(this.state!);

      const preActiveTick = tempState.activeTick;

      const output = this.poolMath.estimateSwap(
        tempState,
        amount,
        from.address.toLowerCase() === this.tokenA.address.toLowerCase(),
        side,
        from.address.toLowerCase() === this.tokenA.address.toLowerCase()
          ? tempState.activeTick + 100n
          : tempState.activeTick - 100n,
      );

      if (output[0] === 0n && output[1] === 0n) {
        this.logger.trace(
          `Reached max swap iteration calculation for address=${this.address} amount=${amount}, from=${from.address}, to=${to.address}, side=${side}`,
        );
        return [0n, 0n];
      }

      const postActiveTick = tempState.activeTick;
      const tickDiff = Math.abs(Number(postActiveTick) - Number(preActiveTick));

      return [
        side ? output[0] : output[1],
        // Tick calculation must be started from 1 to account at least one tick
        BigInt(tickDiff + 1),
      ];
    } catch (e) {
      this.logger.debug(
        `Failed to calculate swap for address=${this.address} amount=${amount}, from=${from.address}, to=${to.address}, side=${side} math: ${e}`,
      );
      return [0n, 0n];
    }
  }
}
