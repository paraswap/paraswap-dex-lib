import _ from 'lodash';
import { Interface, JsonFragment } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import type { AbiItem } from 'web3-utils';
import erc20ABI from '../../abi/erc20.json';
import { Address, Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  EventHandler,
  NervePoolConfig,
  PoolOrMetapoolState,
  PoolState,
} from './types';
import { dexKeyToABIMap, NerveConfig } from './config';
import { BlockHeader } from 'web3-eth';
import { biginterify, ONE, typeCastPoolState, ZERO } from './utils';
import { NervePoolMath } from './nerve-math';

export class NerveEventPool extends StatefulEventSubscriber<PoolState> {
  readonly math: NervePoolMath;

  handlers: {
    [event: string]: EventHandler<PoolOrMetapoolState>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: Address[];

  poolIface: Interface;

  lpTokenIface: Interface;

  private _tokenAddresses?: string[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected poolName: string,
    public poolConfig: NervePoolConfig = NerveConfig[parentName][network]
      .poolConfigs[poolName],
    protected poolABI: JsonFragment[] = dexKeyToABIMap[parentName],
  ) {
    super(`${parentName}_${poolConfig.name}`, logger);
    this.math = new NervePoolMath(this.name, this.logger);

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = [poolConfig.address];

    // Add handlers
    this.handlers['TokenSwap'] = this.handleTokenSwap.bind(this);
    this.handlers['AddLiquidity'] = this.handleAddLiquidity.bind(this);
    this.handlers['RemoveLiquidity'] = this.handleRemoveLiquidity.bind(this);
    this.handlers['RemoveLiquidityOne'] =
      this.handleRemoveLiquidityOne.bind(this);
    this.handlers['RemoveLiquidityImbalance'] =
      this.handleRemoveLiquidityImbalance.bind(this);
    this.handlers['NewAdminFee'] = this.handleNewAdminFee.bind(this);
    this.handlers['NewSwapFee'] = this.handleNewSwapFee.bind(this);
    this.handlers['NewDepositFee'] = this.handleNewDepositFee.bind(this);
    this.handlers['NewWithdrawFee'] = this.handleNewWithdrawFee.bind(this);
    this.handlers['RampA'] = this.handleRampA.bind(this);
    this.handlers['StopRampA'] = this.handleStopRampA.bind(this);

    // IronV2 events support
    this.handlers['TokenExchange'] = this.handleTokenExchange.bind(this);
    this.handlers['NewFee'] = this.handleNewFee.bind(this);

    this.poolIface = new Interface(JSON.stringify(this.poolABI));
    this.lpTokenIface = new Interface(JSON.stringify(erc20ABI));

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
  }

  get tokenAddresses() {
    if (this._tokenAddresses === undefined) {
      this._tokenAddresses = this.tokens.map(token =>
        token.address.toLowerCase(),
      );
    }
    return this._tokenAddresses;
  }

  get address() {
    return this.poolConfig.address;
  }

  get lpToken() {
    return this.poolConfig.lpToken;
  }

  get tokens() {
    return this.poolConfig.coins;
  }

  get tokenPrecisionMultipliers() {
    return this.tokens.map(
      token =>
        biginterify(10) **
        (this.math.POOL_PRECISION_DECIMALS - biginterify(token.decimals)),
    );
  }

  get numTokens() {
    return this.tokens.length;
  }

  processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      const _state: PoolState = typeCastPoolState(state);
      if (event.name in this.handlers)
        return this.handlers[event.name](event, _state, log, blockHeader);
      return _state;
    } catch (e) {
      this.logger.error(`Error: unexpected error handling log:`, e);
    }
    return state;
  }

  async setup(
    blockNumber: number,
    poolState: DeepReadonly<PoolState> | null = null,
  ) {
    if (!poolState) poolState = await this.generateState(blockNumber);
    if (blockNumber) this.setState(poolState, blockNumber);
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<PoolState>> {
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
      biginterify(
        this.lpTokenIface.decodeFunctionResult(
          'totalSupply',
          data.returnData[1],
        )[0]._hex,
      ),
      _.flatten(
        _.range(2, this.numTokens + 2).map(i =>
          biginterify(
            this.poolIface.decodeFunctionResult(
              'getTokenBalance',
              data.returnData[i],
            )[0]._hex,
          ),
        ),
      ),
    ];

    return {
      initialA: biginterify(swapStorage.initialA._hex),
      futureA: biginterify(swapStorage.futureA._hex),
      initialATime: biginterify(swapStorage.initialATime._hex),
      futureATime: biginterify(swapStorage.futureATime._hex),
      // If we have swapFee or fee, use these values, otherwise set to zero
      swapFee:
        ((swapStorage.swapFee || swapStorage.fee) &&
          biginterify((swapStorage.swapFee || swapStorage.fee)._hex)) ||
        ZERO,
      adminFee: biginterify(swapStorage.adminFee._hex),
      defaultDepositFee:
        swapStorage.defaultDepositFee &&
        biginterify(swapStorage.defaultDepositFee._hex),
      defaultWithdrawFee:
        swapStorage.defaultWithdrawFee &&
        biginterify(swapStorage.defaultWithdrawFee._hex),
      lpToken_supply,
      balances,
      tokenPrecisionMultipliers: this.tokenPrecisionMultipliers,
      isValid: true,
    };
  }

  handleNewFee(event: any, state: PoolState) {
    if (!state.isValid) return null;

    state.swapFee = biginterify(event.args.fee);
    state.adminFee = biginterify(event.args.adminFee);
    state.defaultWithdrawFee = biginterify(event.args.withdrawFee);

    return state;
  }

  handleNewAdminFee(event: any, state: PoolState) {
    if (!state.isValid) return null;

    state.adminFee = biginterify(event.args.newAdminFee);
    return state;
  }

  handleNewSwapFee(event: any, state: PoolState) {
    if (!state.isValid) return null;

    state.swapFee = biginterify(event.args.newSwapFee);
    return state;
  }

  handleNewDepositFee(event: any, state: PoolState) {
    if (!state.isValid) return null;

    state.defaultDepositFee = biginterify(event.args.newDepositFee);
    return state;
  }

  handleNewWithdrawFee(event: any, state: PoolState) {
    if (!state.isValid) return null;

    state.defaultWithdrawFee = biginterify(event.args.newWithdrawFee);
    return state;
  }

  handleRampA(event: any, state: PoolState) {
    if (!state.isValid) return null;

    state.initialA = biginterify(event.args.oldA);
    state.futureA = biginterify(event.args.newA);
    state.initialATime = biginterify(event.args.initialTime);
    state.futureATime = biginterify(event.args.futureTime);
    return state;
  }

  handleStopRampA(event: any, state: PoolState) {
    if (!state.isValid) return null;

    // To support IronV2 variable names I use "or" expression
    const finalA = biginterify(event.args.currentA || event.args.A);
    const finalTime = biginterify(event.args.time || event.args.timestamp);

    state.initialA = finalA;
    state.futureA = finalA;
    state.initialATime = finalTime;
    state.futureATime = finalTime;
    return state;
  }

  handleTokenSwap(
    event: any,
    state: PoolState,
    _2: Log,
    blockHeader: BlockHeader,
  ) {
    if (!state.isValid) return null;
    const blockTimestamp = biginterify(blockHeader.timestamp);

    const transferredDx = biginterify(event.args.tokensSold);
    const dyEvent = biginterify(event.args.tokensBought);
    const tokenIndexFrom = event.args.soldId.toNumber();
    const tokenIndexTo = event.args.boughtId.toNumber();

    const swap = this.math.calculateSwap(
      state,
      tokenIndexFrom,
      tokenIndexTo,
      transferredDx,
      blockTimestamp,
    );

    if (swap === null) {
      state.isValid = false;
      return null;
    }

    const { dy, dyFee } = swap;

    const dyAdminFee =
      (dyFee * state.adminFee) /
      this.math.FEE_DENOMINATOR /
      state.tokenPrecisionMultipliers[tokenIndexFrom];

    state.balances[tokenIndexFrom] += transferredDx;
    state.balances[tokenIndexTo] -= dy + dyAdminFee;

    if (dyEvent !== dy) {
      this.logger.error(
        `For ${this.parentName}_${this.poolConfig.name} _calculateSwap value ${dy} is not equal to ${dyEvent} event value`,
      );
      state.isValid = false;
      return null;
    }

    return state;
  }

  // Variation for IronV2. Almost the same as handleTokenSwap
  handleTokenExchange(
    event: any,
    state: PoolState,
    _2: Log,
    blockHeader: BlockHeader,
  ) {
    if (!state.isValid) return null;
    const blockTimestamp = biginterify(blockHeader.timestamp);

    const transferredDx = biginterify(event.args.tokensSold);
    const dyEvent = biginterify(event.args.tokensBought);
    const i = event.args.soldId.toNumber();
    const j = event.args.boughtId.toNumber();

    const normalizedBalances = this.math._xp(state);
    const x =
      normalizedBalances[i] + transferredDx * this.tokenPrecisionMultipliers[i];
    const y = this.math._getY(
      state,
      i,
      j,
      x,
      normalizedBalances,
      blockTimestamp,
    );

    if (y === null) {
      state.isValid = false;
      return null;
    }

    let dy = normalizedBalances[j] - y - ONE;
    const dy_fee = (dy * state.swapFee) / this.math.FEE_DENOMINATOR;
    dy = (dy - dy_fee) / this.tokenPrecisionMultipliers[j];
    const _adminFee =
      (dy_fee * state.adminFee) /
      this.math.FEE_DENOMINATOR /
      this.tokenPrecisionMultipliers[j];

    state.balances[i] += transferredDx;
    state.balances[j] -= dy + _adminFee;

    if (dyEvent !== dy) {
      this.logger.error(
        `For ${this.parentName}_${this.poolConfig.name} _calculateSwap value ${dy} is not equal to ${dyEvent} event value`,
      );
      state.isValid = false;
      return null;
    }

    return state;
  }

  handleAddLiquidity(event: any, state: PoolState) {
    if (!state.isValid) return null;

    const tokenAmounts = event.args.tokenAmounts.map(biginterify) as bigint[];
    const fees = event.args.fees.map(biginterify) as bigint[];
    const lpTokenSupply = biginterify(
      event.args.lpTokenSupply || event.args.tokenSupply,
    );

    // Original Nerve emits total supply, but IronV2 the difference between supplies
    state.lpToken_supply =
      event.args.lpTokenSupply !== undefined
        ? lpTokenSupply
        : state.lpToken_supply + lpTokenSupply;

    for (const [i, tokenAmount] of tokenAmounts.entries()) {
      // We receive the real transferred amount. No need to check it
      state.balances[i] += tokenAmount;
      state.balances[i] -=
        (fees[i] * state.adminFee) / this.math.FEE_DENOMINATOR;
    }
    return state;
  }

  handleRemoveLiquidity(event: any, state: PoolState) {
    if (!state.isValid) return null;

    const tokenAmounts = event.args.tokenAmounts.map(biginterify) as bigint[];
    const lpTokenSupply = biginterify(
      event.args.lpTokenSupply || event.args.tokenSupply,
    );

    state.lpToken_supply = lpTokenSupply;
    for (const [i, tokenAmount] of tokenAmounts.entries()) {
      // We receive the real transferred amount. No need to check it
      state.balances[i] -= tokenAmount;
    }
    return state;
  }

  handleRemoveLiquidityOne(_0: any, state: PoolState, _2: Log) {
    // To calculate remove liquidity one, we need to calculate the user fee.
    // It depends on the time when user deposited assets. That info can be obtained
    // by onchain call, but here there is no point of doing this.
    // Therefore we just invalidate our state so that next state request will generate new one

    state.isValid = false;
    return state;
  }

  handleRemoveLiquidityImbalance(event: any, state: PoolState) {
    const tokenAmounts = event.args.tokenAmounts.map(biginterify) as bigint[];
    const fees = event.args.fees.map(biginterify) as bigint[];
    const lpTokenSupply = biginterify(
      event.args.lpTokenSupply || event.args.tokenSupply,
    );

    state.lpToken_supply = lpTokenSupply;
    for (const [i, tokenAmount] of tokenAmounts.entries()) {
      state.balances[i] -= tokenAmount;
      state.balances[i] -=
        (fees[i] * state.adminFee) / this.math.FEE_DENOMINATOR;
    }

    return state;
  }
}
