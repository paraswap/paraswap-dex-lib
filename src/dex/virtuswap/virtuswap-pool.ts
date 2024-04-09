import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { assert, AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger, Token } from '../../types';
import { MultiCallParams } from '../../lib/multi-wrapper';
import {
  bigIntify,
  catchParseLogError,
  normalizeAddress,
  stringify,
} from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper';
import { PoolState } from './types';
import vPairABI from '../../abi/virtuswap/vPair.json';
import { abiCoderParsers } from './utils';
import { BlockHeader } from 'web3-eth';

export class VirtuSwapEventPool extends StatefulEventSubscriber<PoolState> {
  static readonly BASE_FACTOR = 1000n;
  static readonly RESERVE_RATIO_FACTOR = VirtuSwapEventPool.BASE_FACTOR * 100n;
  static readonly vPairInterface = new Interface(vPairABI);
  static readonly contractStateFunctionsParsers = [
    abiCoderParsers.Address.create('token0', 'address'),
    abiCoderParsers.Address.create('token1', 'address'),
    abiCoderParsers.BigInt.create('pairBalance0', 'uint112'),
    abiCoderParsers.BigInt.create('pairBalance1', 'uint112'),
    abiCoderParsers.Int.create('fee', 'uint16'),
    abiCoderParsers.Int.create('vFee', 'uint16'),
    abiCoderParsers.Int.create('lastSwapBlock', 'uint128'),
    abiCoderParsers.Int.create('blocksDelay', 'uint128'),
    abiCoderParsers.BigInt.create('reservesBaseValueSum', 'uint256'),
    abiCoderParsers.BigInt.create('maxReserveRatio', 'uint256'),
    abiCoderParsers.Int.create('allowListLength', 'uint256'),
  ] as const;
  static readonly contractAllowListAddressParser =
    abiCoderParsers.Address.create('allowList', 'address');
  static readonly contractReservesBaseValueParser =
    abiCoderParsers.BigInt.create('reservesBaseValue', 'uint256');
  static readonly contractReservesParser = abiCoderParsers.BigInt.create(
    'reserves',
    'uint256',
  );

  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
      blockHeader: Readonly<BlockHeader>,
    ) => AsyncOrSync<DeepReadonly<PoolState> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected isTimestampBased: boolean,
    protected poolAddress: Address,
    protected vPairIface: Interface = VirtuSwapEventPool.vPairInterface,
  ) {
    super(
      parentName,
      `${parentName}_${network}_${poolAddress}`,
      dexHelper,
      logger,
    );

    this.logDecoder = (log: Log) => this.vPairIface.parseLog(log);
    this.addressesSubscribed = [poolAddress];

    this.handlers['vSync'] = this.handleSync.bind(this); // 0xa74621c1abba1dca03b6708d02443d60ddfd3f4273745060c4355afc9daa52c6
    this.handlers['ReserveSync'] = this.handleReserveSync.bind(this); // 0x3f78f965596026d67092e66b7de2aaf2c33839a6b15485c4dec57f03e35e8a3e
    this.handlers['AllowListChanged'] = this.handleAllowListChanged.bind(this); // 0xc2d08e7ae40f88bd169469bbcfa69c8213cb98772e0bab7de792256c59139eec
    this.handlers['FeeChanged'] = this.handleFeeChanged.bind(this); // 0xaa1ebd1f8841401ae5e1a0f2febc87d5f597ae458fca8277cd0e43b92633183c
    this.handlers['ReserveThresholdChanged'] =
      this.handleReserveThresholdChanged.bind(this); // 0x047f24f47d2c93ef7523cb3c84c3b367df61e4899214a2a48784cfa09da91fdf
    this.handlers['BlocksDelayChanged'] =
      this.handleBlocksDelayChanged.bind(this); // 0xcaaa7d3acc870fbbecd0fd5b1b5318711a76bc6beee2883e7c8d6bbf3c77b3ad
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @param blockHeader - Block header of the block in which the log was released
   * @returns Updates state of the event subscriber after the log
   */
  protected async processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<PoolState> | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, log, blockHeader);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  /**
   * The function is called to fetch reserves of the pool
   * @param addresses - Addresses of the allowed reserve tokens in the pool
   * @param blockNumber - Blocknumber for which the reserves should be fetched
   * @returns Reserves of the pool
   */
  protected async fetchReserves(
    addresses: Address[],
    blockNumber: number,
  ): Promise<PoolState['reserves']> {
    const reservesMultiCallParams = addresses.flatMap(
      address =>
        [
          {
            target: this.poolAddress,
            callData: this.vPairIface.encodeFunctionData('reservesBaseValue', [
              address,
            ]),
            decodeFunction:
              VirtuSwapEventPool.contractReservesBaseValueParser.decodeFunction,
          },
          {
            target: this.poolAddress,
            callData: this.vPairIface.encodeFunctionData('reserves', [address]),
            decodeFunction:
              VirtuSwapEventPool.contractReservesParser.decodeFunction,
          },
        ] as MultiCallParams<bigint>[],
    );

    const reservesReturnData = await this.dexHelper.multiWrapper.aggregate(
      reservesMultiCallParams,
      blockNumber,
    );

    return _.fromPairs(
      _.map(_.chunk(reservesReturnData, 2), ([baseValue, balance], index) => [
        addresses[index],
        { baseValue, balance },
      ]),
    );
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    // Get initial data and allowListLength
    const initialMultiCallParams =
      VirtuSwapEventPool.contractStateFunctionsParsers.map(
        ({ name, decodeFunction }) =>
          ({
            target: this.poolAddress,
            callData: this.vPairIface.encodeFunctionData(name),
            decodeFunction,
          } as MultiCallParams<ReturnType<typeof decodeFunction>>),
      );

    const initialReturnData = await this.dexHelper.multiWrapper.aggregate(
      initialMultiCallParams,
      blockNumber,
    );

    type stateFunctionParserType =
      typeof VirtuSwapEventPool.contractStateFunctionsParsers[number];

    const initialState = _.fromPairs(
      VirtuSwapEventPool.contractStateFunctionsParsers
        .filter(({ name }) => name !== 'allowListLength')
        .map(({ name }, i) => [name, initialReturnData[i]]),
    ) as Pick<
      PoolState,
      Exclude<stateFunctionParserType['name'], 'allowListLength'>
    >;

    const allowListLength = _.last(initialReturnData) as number;

    // Get allow list (addresses of allowed tokens)
    const allowListMultiCallParams = Array.from(
      { length: allowListLength },
      (_, i) =>
        ({
          target: this.poolAddress,
          callData: this.vPairIface.encodeFunctionData('allowList', [i]),
          decodeFunction:
            VirtuSwapEventPool.contractAllowListAddressParser.decodeFunction,
        } as MultiCallParams<Address>),
    );

    const allowList = (
      await this.dexHelper.multiWrapper.aggregate(
        allowListMultiCallParams,
        blockNumber,
      )
    ).filter(
      (address: Address) =>
        address !== initialState.token0 && address !== initialState.token1,
    );

    // Get reserves info for each token in allow list
    const reserves = await this.fetchReserves(allowList, blockNumber);

    return {
      ...initialState,
      reserves,
    };
  }

  handleSync(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    const pairBalance0 = bigIntify(event.args.balance0);
    const pairBalance1 = bigIntify(event.args.balance1);
    // we use block.timestamp for lastSwapBlock on Arbitrum due to differences in how block.number works there
    // (see https://docs.arbitrum.io/for-devs/troubleshooting-building#how-do-blocknumber-and-blocktimestamp-work-on-arbitrum)
    const lastSwapBlock = this.isTimestampBased
      ? Number(blockHeader.timestamp)
      : blockHeader.number;
    return {
      ...state,
      lastSwapBlock,
      pairBalance0,
      pairBalance1,
    };
  }

  async handleReserveSync(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<PoolState> | null> {
    const reserveToken = normalizeAddress(stringify(event.args.asset));
    const newReserveBalance = bigIntify(event.args.balance);

    if (newReserveBalance === 0n) {
      const reservesBaseValueSum =
        state.reservesBaseValueSum - state.reserves[reserveToken].baseValue;
      const reserves = {
        ...state.reserves,
        [reserveToken]: { balance: 0n, baseValue: 0n },
      };
      return {
        ...state,
        reserves,
        reservesBaseValueSum,
      };
    } else {
      const rRatio = bigIntify(event.args.rRatio);
      // TODO: check if we can use info from SwapReserve event to calculate baseValue
      /*
       * we cannot recover the baseValue for reserveToken from rRatio due to
       * integer division, so we need to re-fetch reserve info for this token
       * and recalculate reservesBaseValueSum
       */
      const tokenReserve = await this.fetchReserves(
        [reserveToken],
        blockHeader.number,
      );
      const reserves = {
        ...state.reserves,
        ...tokenReserve,
      };

      const reservesBaseValueSum = _.reduce(
        _.values(reserves),
        (sum, { baseValue }) => sum + baseValue,
        0n,
      );

      // calculate rRatio from local state
      const rRatioRestored =
        (reservesBaseValueSum * VirtuSwapEventPool.RESERVE_RATIO_FACTOR) /
        (state.pairBalance0 << 1n);

      // rRatios must be the same if the pool state is correct
      assert(
        rRatio === rRatioRestored,
        `Pool ${
          this.poolAddress
        }: rRatio value is out of sync: rRatio=${rRatio.toString()}; rRatioRestored=${rRatioRestored.toString()}`,
      );

      return {
        ...state,
        reserves,
        reservesBaseValueSum,
      };

      // the code below leads to inaccurate calculation of baseValue due to integer division of rRatio in vPair contract
      /*
      const reservesBaseValueSum =
        (rRatio * (state.pairBalance0 << 1n)) /
        VirtuSwapEventPool.RESERVE_RATIO_FACTOR;

      const newReserveBaseValue =
        reservesBaseValueSum -
        state.reservesBaseValueSum +
        state.reserves[reserveToken].baseValue;

      const reserves = {
        ...state.reserves,
        [reserveToken]: {
          balance: newReserveBalance,
          baseValue: newReserveBaseValue,
        },
      };

      return {
        ...state,
        reserves,
        reservesBaseValueSum,
      };
      */
    }
  }

  async handleAllowListChanged(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<PoolState> | null> {
    const allowList = event.args.tokens
      .map((token: any) => normalizeAddress(stringify(token)))
      .filter(
        (address: Address) =>
          address !== state.token0 && address !== state.token1,
      );

    // we need to fetch reserves for new tokens and recalculate reservesBaseValueSum
    const reserves = await this.fetchReserves(allowList, blockHeader.number);
    const reservesBaseValueSum = _.reduce(
      _.values(reserves),
      (sum, { baseValue }) => sum + baseValue,
      0n,
    );

    return {
      ...state,
      reserves,
      reservesBaseValueSum,
    };
  }

  handleFeeChanged(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    const fee = Number(event.args.fee);
    const vFee = Number(event.args.vFee);
    return {
      ...state,
      fee,
      vFee,
    };
  }

  handleReserveThresholdChanged(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    const maxReserveRatio = bigIntify(event.args.newThreshold);
    return {
      ...state,
      maxReserveRatio,
    };
  }

  handleBlocksDelayChanged(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    const blocksDelay = Number(event.args._newBlocksDelay);
    return {
      ...state,
      blocksDelay,
    };
  }
}

export type VirtuSwapPair = {
  token0: Token;
  token1: Token;
  exchange?: Address;
  pool?: VirtuSwapEventPool;
};
