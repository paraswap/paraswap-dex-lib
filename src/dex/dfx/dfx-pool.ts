import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DFXPoolConfig } from './types';
import CurvepoolABI from '../../abi/dfx/Curve-pool.json';
import { DfxConfig } from './config';
import erc20ABI from '../../abi/erc20.json';
import { typeCastPoolState } from '../nerve/utils';
import { PoolState } from '../nerve/types';

export class DfxEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;
  public readonly poolIface = new Interface(CurvepoolABI);
  lpTokenIface: Interface;

  addressesSubscribed: string[];

  get address() {
    return this.poolConfig.address;
  }

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    token0: Address,
    token1: Address,
    protected poolName: string,
    public poolConfig: DFXPoolConfig = DfxConfig[parentName][network]
      .poolConfigs[poolName],
    protected dfxIface = new Interface(
      '' /* TODO: Import and put here Dfx ABI */,
    ), // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add pool name
    super(parentName, `${token0}_${token1}_v3`, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.dfxIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    this.handlers['Swap'] = this.handleTokenSwap.bind(this);
    this.lpTokenIface = new Interface(JSON.stringify(erc20ABI));
  }
  get tokens() {
    return this.poolConfig.coins;
  }

  get lpToken() {
    return this.poolConfig.lpToken;
  }
  get numTokens() {
    return this.tokens.length;
  }

  get tokenPrecisionMultipliers() {
    return this.tokens.map(
      token => bigIntify(10) ** (BigInt(1) - bigIntify(token.decimals)),
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
  processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> {
    try {
      const event = this.logDecoder(log);
      const _state: PoolState = typeCastPoolState(state);
      if (event.name in this.handlers)
        return this.handlers[event.name](event, _state, log, blockHeader);
      return state;
    } catch (e) {
      this.logger.error(`Unexpected error handling log:`, e);
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const calldata = _.flattenDeep([
      {
        target: this.address,
        callData: this.poolIface.encodeFunctionData('swapStorage', []),
      },
      {
        target: this.lpToken.address,
        callData: this.lpTokenIface.encodeFunctionData('totalSupply', []),
      },
      _.range(0, this.numTokens).map(poolIndex => ({
        target: this.address,
        callData: this.poolIface.encodeFunctionData('getTokenBalance', [
          poolIndex,
        ]),
      })),
    ]);

    const data = await this.dexHelper.multiContract.methods
      .aggregate(calldata)
      .call({}, blockNumber);

    const [swapStorage, lpToken_supply, balances] = [
      this.poolIface.decodeFunctionResult('swapStorage', data.returnData[0]),
      bigIntify(
        this.lpTokenIface.decodeFunctionResult(
          'totalSupply',
          data.returnData[1],
        )[0]._hex,
      ),
      this.poolIface.decodeFunctionResult('paused', data.returnData[2]),
      _.flatten(
        _.range(3, this.numTokens + 3).map(i =>
          bigIntify(
            this.poolIface.decodeFunctionResult(
              'getTokenBalance',
              data.returnData[i],
            )[0]._hex,
          ),
        ),
      ),
    ];

    return {
      initialA: bigIntify(swapStorage.initialA._hex),
      futureA: bigIntify(swapStorage.futureA._hex),
      initialATime: bigIntify(swapStorage.initialATime._hex),
      futureATime: bigIntify(swapStorage.futureATime._hex),
      // If we have swapFee or fee, use these values, otherwise set to zero
      swapFee:
        ((swapStorage.swapFee || swapStorage.fee) &&
          bigIntify((swapStorage.swapFee || swapStorage.fee)._hex)) ||
        0n,
      adminFee: bigIntify(swapStorage.adminFee._hex),
      defaultDepositFee:
        swapStorage.defaultDepositFee &&
        bigIntify(swapStorage.defaultDepositFee._hex),
      defaultWithdrawFee:
        swapStorage.defaultWithdrawFee &&
        bigIntify(swapStorage.defaultWithdrawFee._hex),
      lpToken_supply,
      balances,
      tokenPrecisionMultipliers: this.tokenPrecisionMultipliers,
      isValid: true,
      paused: false,
    };
  }

  // Its just a dummy example
  handleMyEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleTokenSwap(
    event: any,
    state: PoolState,
    _2: Log,
    blockHeader: BlockHeader,
  ) {
    if (!state.isValid) return state;
    const blockTimestamp = bigIntify(blockHeader.timestamp);

    const transferredDx = bigIntify(event.args.tokensSold);
    const dyEvent = bigIntify(event.args.tokensBought);
    const tokenIndexFrom = event.args.soldId.toNumber();
    const tokenIndexTo = event.args.boughtId.toNumber();

    try {
      // const swap = this.math.calculateSwap(
      //   state,
      //   tokenIndexFrom,
      //   tokenIndexTo,
      //   transferredDx,
      //   blockTimestamp,
      // );
      const dy = BigInt(2);
      const dyFee = BigInt(1);
      const dyAdminFee = (dyFee * state.adminFee) / BigInt(2) / BigInt(2);

      state.balances[tokenIndexFrom] += transferredDx;
      state.balances[tokenIndexTo] -= dy + dyAdminFee;

      if (dyEvent !== dy) {
        this.logger.error(
          `For ${this.parentName}_${this.poolConfig.name} _calculateSwap value ${dy} is not equal to ${dyEvent} event value`,
        );
        state.isValid = false;
      }
    } catch (e) {
      state.isValid = false;
    }
    return state;
  }
}
