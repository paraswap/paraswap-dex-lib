import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import type { AbiItem } from 'web3-utils';
const erc20ABI = require('../../abi/erc20.json');
const nervePoolABI = require('../../abi/nerve/nerve-pool.json');
import {
  Token,
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { NerveData, NervePoolConfig, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { NerveConfig, Adapters } from './config';
import { getManyPoolStates } from './getstate-multicall';
import { BlockHeader } from 'web3-eth';
import { biginterify, ZERO, ONE, MathUtil } from './utils';

export class NerveEventPool extends StatefulEventSubscriber<PoolState> {
  protected readonly FEE_DENOMINATOR = biginterify(10 ** 10);
  protected readonly A_PRECISION = biginterify(100);
  protected readonly MAX_LOOP_LIMIT = biginterify(256);

  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      log: Log,
      blockHeader: BlockHeader,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: Address[];

  poolIface: Interface;

  lpTokenIface: Interface;

  isStateValid = true;

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected adapters = Adapters[network], // TODO: add any additional params required for event subscriber
    public poolConfig: NervePoolConfig,
    protected nervePoolABI: AbiItem[] = nervePoolABI,
  ) {
    super(`${parentName}_${poolConfig.name}`, logger);

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = [poolConfig.address];
    if (poolConfig.trackCoins) {
      this.addressesSubscribed = _.concat(
        this.poolCoins,
        this.addressesSubscribed,
      );
    }

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

    this.poolIface = new Interface(JSON.stringify(this.nervePoolABI));
    this.lpTokenIface = new Interface(JSON.stringify(erc20ABI));

    this.logDecoder = (log: Log) => {
      if (
        this.poolConfig.trackCoins &&
        _.findIndex(
          this.poolCoins,
          c => c.toLowerCase() === log.address.toLowerCase(),
        ) != -1
      )
        return this.lpTokenIface.parseLog(log);

      return this.poolIface.parseLog(log);
    };
  }

  get poolAddress() {
    return this.poolConfig.address;
  }

  get lpTokenAddress() {
    return this.poolConfig.lpTokenAddress;
  }

  get poolCoins() {
    return this.poolConfig.coins;
  }

  get numTokens() {
    return this.poolCoins.length;
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      const _state: PoolState = {
        initialA: biginterify(state.initialA),
        futureA: biginterify(state.futureA),
        initialATime: biginterify(state.initialATime),
        futureATime: biginterify(state.futureATime),
        swapFee: biginterify(state.swapFee),
        adminFee: biginterify(state.adminFee),
        defaultDepositFee: biginterify(state.defaultDepositFee),
        defaultWithdrawFee: biginterify(state.defaultWithdrawFee),
        lpToken_supply: biginterify(state.lpToken_supply),
        balances: state.balances.map(biginterify),
        tokenPrecisionMultipliers:
          state.tokenPrecisionMultipliers.map(biginterify),
      };
      if (event.name in this.handlers)
        return this.handlers[event.name](event, _state, log, blockHeader);
      return _state;
    } catch (e) {
      this.logger.error(`Error: unexpected error handling log:`, e);
    }
    return state;
  }

  async setup(blockNumber: number, poolState: PoolState | null = null) {
    if (!poolState) poolState = await this.generateState(blockNumber);
    if (blockNumber) this.setState(poolState, blockNumber);
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<Readonly<PoolState>> {
    return (
      await getManyPoolStates([this], this.dexHelper.multiContract, blockNumber)
    )[0];
  }

  handleNewAdminFee(event: any, state: PoolState) {
    state.adminFee = biginterify(event.args.newAdminFee);
    return state;
  }

  handleNewSwapFee(event: any, state: PoolState) {
    state.swapFee = biginterify(event.args.newSwapFee);
    return state;
  }

  handleNewDepositFee(event: any, state: PoolState) {
    state.defaultDepositFee = biginterify(event.args.newDepositFee);
    return state;
  }

  handleNewWithdrawFee(event: any, state: PoolState) {
    state.defaultWithdrawFee = biginterify(event.args.newWithdrawFee);
    return state;
  }

  handleRampA(event: any, state: PoolState) {
    state.initialA = biginterify(event.args.oldA);
    state.futureA = biginterify(event.args.newA);
    state.initialATime = biginterify(event.args.initialTime);
    state.futureATime = biginterify(event.args.futureTime);
    return state;
  }

  handleStopRampA(event: any, state: PoolState) {
    const finalA = biginterify(event.args.currentA);
    const finalTime = biginterify(event.args.time);

    state.initialA = finalA;
    state.futureA = finalA;
    state.initialATime = finalTime;
    state.futureATime = finalTime;
    return state;
  }

  handleTokenSwap(
    event: any,
    state: PoolState,
    _0: Log,
    blockHeader: BlockHeader,
  ) {
    const blockTimestamp = biginterify(blockHeader.timestamp);

    const transferredDx = biginterify(event.args.tokensSold);
    const dyEvent = biginterify(event.args.tokensBought);
    const tokenIndexFrom = event.args.soldId.toNumber();
    const tokenIndexTo = event.args.boughtId.toNumber();

    const swap = this._calculateSwap(
      state,
      tokenIndexFrom,
      tokenIndexTo,
      transferredDx,
      blockTimestamp,
    );

    if (swap === undefined) {
      this.isStateValid = false;
      return state;
    }

    const { dy, dyFee } = swap;

    const dyAdminFee =
      (dyFee * state.adminFee) /
      this.FEE_DENOMINATOR /
      state.tokenPrecisionMultipliers[tokenIndexFrom];

    state.balances[tokenIndexFrom] += transferredDx;
    state.balances[tokenIndexTo] -= dy - dyAdminFee;

    if (dyEvent !== dy) {
      this.logger.error(
        `For ${this.parentName}_${this.poolConfig.name} _calculateSwap value ${dy} is not equal to ${dyEvent} event value`,
      );
      this.isStateValid = false;
    }

    return state;
  }

  handleAddLiquidity(event: any, state: PoolState) {
    const tokenAmounts = event.args.tokenAmounts.map(biginterify);
    const fees = event.args.fees.map(biginterify);
    const invariant = biginterify(event.args.invariant);
    const lpTokenSupply = biginterify(event.args.lpTokenSupply);

    state.lpToken_supply = lpTokenSupply;

    return state;
  }

  handleRemoveLiquidity(event: any, state: PoolState) {}

  handleRemoveLiquidityOne(event: any, state: PoolState) {}

  handleRemoveLiquidityImbalance(event: any, state: PoolState) {}

  protected _calculateSwap(
    state: PoolState,
    tokenIndexFrom: number,
    tokenIndexTo: number,
    dx: bigint,
    blockTimestamp: bigint,
  ) {
    const xp = this._xp(state);

    // uint256 x = dx.mul(self.tokenPrecisionMultipliers[tokenIndexFrom])
    //    .add(xp[tokenIndexFrom]);
    const x =
      dx * state.tokenPrecisionMultipliers[tokenIndexFrom] + xp[tokenIndexFrom];

    const y = this._getY(
      state,
      tokenIndexFrom,
      tokenIndexTo,
      x,
      xp,
      blockTimestamp,
    );

    if (y === undefined) {
      this.isStateValid = false;
      return undefined;
    }

    // dy = xp[tokenIndexTo].sub(y).sub(1);
    let dy = xp[tokenIndexTo] - y - ONE;

    // dyFee = dy.mul(self.swapFee).div(FEE_DENOMINATOR);
    const dyFee = (dy * state.swapFee) / this.FEE_DENOMINATOR;

    // dy = dy.sub(dyFee).div(self.tokenPrecisionMultipliers[tokenIndexTo]);
    dy = (dy - dyFee) / state.tokenPrecisionMultipliers[tokenIndexTo];
    return { dy, dyFee };
  }

  protected _getY(
    state: PoolState,
    tokenIndexFrom: number,
    tokenIndexTo: number,
    x: bigint,
    xp: bigint[],
    blockTimestamp: bigint,
  ) {
    const numTokens = biginterify(this.numTokens);
    const a = this._getAPrecise(state, blockTimestamp);
    const d = this._getD(xp, a);
    let c = d;
    let s: bigint;
    const nA = numTokens * a;

    let _x: bigint;
    for (let i = 0; i < numTokens; i++) {
      if (i == tokenIndexFrom) {
        _x = x;
      } else if (i != tokenIndexTo) {
        _x = xp[i];
      } else {
        continue;
      }
      s = s + _x;
      // c = c.mul(d).div(_x.mul(numTokens));
      c = (c * d) / (_x * numTokens);
    }
    // c = c.mul(d).mul(A_PRECISION).div(nA.mul(numTokens));
    c = (c * d * this.A_PRECISION) / (nA * numTokens);

    // uint256 b = s.add(d.mul(A_PRECISION).div(nA));
    const b = s + (d * this.A_PRECISION) / nA;
    let yPrev: bigint;
    let y = d;

    for (let i = 0; i < this.MAX_LOOP_LIMIT; i++) {
      yPrev = y;
      // y = y.mul(y).add(c).div(y.mul(2).add(b).sub(d));
      y = (y * y + c) / (y * biginterify(2) + b - d);

      if (MathUtil.within1(y, yPrev)) {
        return y;
      }
    }

    this.logger.error(
      `Event pool ${this.name} parsing function _getY approximation did not converge`,
    );
    this.isStateValid = false;
    return undefined;
  }

  protected _getAPrecise(state: PoolState, blockTimestamp: bigint) {
    const t1 = state.futureATime; // time when ramp is finished
    const a1 = state.futureA; // final A value when ramp is finished

    if (blockTimestamp < t1) {
      const t0 = state.initialATime; // time when ramp is started
      const a0 = state.initialA; // initial A value when ramp is started
      if (a1 > a0) {
        // a0.add(a1.sub(a0).mul(block.timestamp.sub(t0)).div(t1.sub(t0)));
        return a0 + ((a1 - a0) * (blockTimestamp - t0)) / (t1 - t0);
      } else {
        // a0.sub(a0.sub(a1).mul(block.timestamp.sub(t0)).div(t1.sub(t0)));
        return a0 - ((a0 - a1) * (blockTimestamp - t0)) / (t1 - t0);
      }
    } else {
      return a1;
    }
  }

  protected _getD(xp: bigint[], a: bigint) {
    const numTokens = biginterify(xp.length);
    let s: bigint;
    for (let i = 0; i < numTokens; i++) {
      s = s + xp[i];
    }
    if (s === ZERO) {
      return ZERO;
    }

    let prevD: bigint;
    let d = s;
    let nA = a * numTokens;

    for (let i = 0; i < this.MAX_LOOP_LIMIT; i++) {
      let dP = d;
      for (let j = 0; j < numTokens; j++) {
        // dP = dP.mul(d).div(xp[j].mul(numTokens));
        dP = (dP * d) / (xp[j] * numTokens);
      }
      prevD = d;
      // d = nA.mul(s).div(A_PRECISION).add(dP.mul(numTokens)).mul(d).div(
      //    nA.sub(A_PRECISION).mul(d).div(A_PRECISION).add(
      //      numTokens.add(1).mul(dP)));
      d =
        (nA * s) / this.A_PRECISION +
        (dP * numTokens * d) /
          (((nA - this.A_PRECISION) * d) /
            (this.A_PRECISION + (numTokens + ONE) * dP));
      if (MathUtil.within1(d, prevD)) {
        return d;
      }
    }

    // Convergence should occur in 4 loops or less. If this is reached, there may be something wrong
    // with the pool.
    this.logger.error(`Event pool ${this.name} method _getD did not converge`);
    this.isStateValid = false;
    return undefined;
  }

  protected _xp(state: PoolState) {
    return state.balances.map(
      (balanceValue, i) => balanceValue * state.tokenPrecisionMultipliers[i],
    );
  }
}
