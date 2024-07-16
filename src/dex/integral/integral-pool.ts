import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { LogDescription } from 'ethers/lib/utils';
import { AsyncOrSync } from 'ts-essentials';
import { BlockHeader, Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import IntegralPoolABI from '../../abi/integral/pool.json';
import IntegralOracleABI from '../../abi/integral/oracle.json';
import UniswapV3PoolABI from '../../abi/uniswap-v3/UniswapV3Pool.abi.json';
import { Address } from '../../types';
import { MultiCallParams } from '../../lib/multi-wrapper';
import {
  addressDecode,
  uint256ToBigInt,
  uint8ToNumber,
} from '../../lib/decoders';
import { AbiItem } from 'web3-utils';
import { BigNumber } from 'ethers';

export class IntegralEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      blockHeader: Readonly<BlockHeader>,
    ) => AsyncOrSync<PoolState>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  readonly poolAddress: Address;
  readonly token0: Address;
  readonly token1: Address;

  constructor(
    public parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    poolAddress: Address,
    token0: Address,
    token1: Address,
    logger: Logger,
    protected poolIface = new Interface(IntegralPoolABI),
  ) {
    super(parentName, `${token0}_${token1}`, dexHelper, logger);
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();
    this.poolAddress = poolAddress.toLowerCase();

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = [this.poolAddress];
    this.handlers['SetSwapFee'] = this.handleSetSwapFee.bind(this);
    this.handlers['SetMintFee'] = this.handleSetMintFee.bind(this);
    this.handlers['SetBurnFee'] = this.handleSetBurnFee.bind(this);
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
  protected async processLog(
    state: PoolState,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<PoolState | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, blockHeader);
      }
      return state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
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
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    const state = {} as PoolState;
    const pool = new this.dexHelper.web3Provider.eth.Contract(
      IntegralPoolABI as AbiItem[],
      this.poolAddress,
    );
    const poolInfoCallDatas: MultiCallParams<string | bigint>[] = [
      {
        target: this.poolAddress,
        callData: pool.methods.oracle().encodeABI(),
        decodeFunction: addressDecode,
      },
      {
        target: this.poolAddress,
        callData: pool.methods.mintFee().encodeABI(),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.poolAddress,
        callData: pool.methods.burnFee().encodeABI(),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.poolAddress,
        callData: pool.methods.swapFee().encodeABI(),
        decodeFunction: uint256ToBigInt,
      },
    ];
    const poolInfos = await this.dexHelper.multiWrapper.aggregate<
      string | bigint
    >(poolInfoCallDatas, blockNumber);
    const oracleAddress = poolInfos[0].toString();

    state.mintFee = BigInt(poolInfos[1]);
    state.burnFee = BigInt(poolInfos[2]);
    state.swapFee = BigInt(poolInfos[3]);
    state.oracle = oracleAddress;

    const historyState = this.getStaleState();
    if (!historyState) {
      const oracle = new this.dexHelper.web3Provider.eth.Contract(
        IntegralOracleABI as AbiItem[],
        oracleAddress,
      );
      const oracleInfosCallDatas: MultiCallParams<number | string>[] = [
        {
          target: oracleAddress,
          callData: oracle.methods.xDecimals().encodeABI(),
          decodeFunction: uint8ToNumber,
        },
        {
          target: oracleAddress,
          callData: oracle.methods.yDecimals().encodeABI(),
          decodeFunction: uint8ToNumber,
        },
        {
          target: oracleAddress,
          callData: oracle.methods.uniswapPair().encodeABI(),
          decodeFunction: addressDecode,
        },
      ];
      const oracleInfos = await this.dexHelper.multiWrapper.aggregate<
        number | string
      >(oracleInfosCallDatas, blockNumber);

      state.uniswapPool = oracleInfos[2].toString();
      state.decimals0 = Number(oracleInfos[0]);
      state.decimals1 = Number(oracleInfos[1]);

      const uniswapPool = new this.dexHelper.web3Provider.eth.Contract(
        UniswapV3PoolABI as AbiItem[],
        state.uniswapPool,
      );
      const fee = await uniswapPool.methods.fee().call(undefined, blockNumber);
      state.uniswapPoolFee = BigInt(fee);
    } else {
      state.uniswapPool = historyState.uniswapPool;
      state.decimals0 = historyState.decimals0;
      state.decimals1 = historyState.decimals1;
      state.uniswapPoolFee = historyState.uniswapPoolFee;
    }

    return state;
  }

  handleSetSwapFee(event: LogDescription, pool: PoolState) {
    pool.swapFee = BigInt(BigNumber.from(event.args.fee).toString());
    return pool;
  }

  handleSetMintFee(event: LogDescription, pool: PoolState) {
    pool.mintFee = BigInt(BigNumber.from(event.args.fee).toString());
    return pool;
  }

  handleSetBurnFee(event: LogDescription, pool: PoolState) {
    pool.burnFee = BigInt(BigNumber.from(event.args.fee).toString());
    return pool;
  }
}
