import _ from 'lodash';
import { Address, Log } from '../../../types';

import StableSwap3Pool from '../../../abi/curve/StableSwap3Pool.json';
import { CurvePool, PoolState } from './curve-pool';
import { IDexHelper } from '../../../dex-helper';
import { BN_0 } from '../../../bignumber-constants';
import { bigNumberify } from '../../../utils';
import { stringify } from 'querystring';
import BigNumber from 'bignumber.js';

const pool = '3pool';

export const address: Address =
  '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'.toLowerCase();
const tokenAddress: Address = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';

const N_COINS: number = 3;
const PRECISION_MUL = ['1', '1000000000000', '1000000000000'].map(bigNumberify);
const USE_LENDING = [false, false, false];
const COINS = [
  '0x6b175474e89094c44da98b954eedeac495271d0f',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
];
const trackCoins = true;

export class ThreePool extends CurvePool {
  // The lastTransferredCoin is not stored in the state as
  // the value itself doesn't effect the pricing but it only
  // affects the function call RemoveLiquidityOne for that
  // particular block.
  lastTransferredCoin?: Address;
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwap3Pool,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    prefix = 'ThreePool',
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger(prefix),
      _pool,
      _address,
      _tokenAddress,
      _trackCoins,
      _abi,
      _N_COINS,
      _PRECISION_MUL,
      _USE_LENDING,
      _COINS,
    );
    // Add pool specific handlers or overloaded handlers
    this.handlers['RemoveLiquidityOne'] =
      this.handleRemoveLiquidityOne.bind(this);
    this.handlers['NewFee'] = this.handleNewFee.bind(this);
    this.handlers['Transfer'] = this.handleCoinTransfer.bind(this);
  }

  handleCoinTransfer(event: any, state: PoolState, log: Log): PoolState {
    const from = event.args.src;
    const coin = log.address;

    if (from.toLowerCase() == this.address.toLowerCase())
      this.lastTransferredCoin = coin.toLowerCase();
    return state;
  }

  handleNewFee(event: any, state: PoolState, log: Log): PoolState {
    const fee = bigNumberify(stringify(event.args.fee));
    const admin_fee = bigNumberify(stringify(event.args.admin_fee));

    state.fee = fee;
    state.admin_fee = admin_fee;
    return state;
  }

  remove_liquidity_one_coin(
    token_amount: BigNumber,
    i: number,
    state: PoolState,
  ): BigNumber {
    const rates = this.getRates();
    // let dy: BigNumber = BN_0
    // let dy_fee: BigNumber = BN_0

    let { dy, dy_fee } = this._calc_withdraw_one_coin(
      token_amount,
      i,
      state.A,
      state.fee,
      state.supply,
      rates,
      state.balances,
    );
    // assert dy >= min_amount, "Not enough coins removed"
    state.balances[i] = state.balances[i].minus(
      dy.plus(dy_fee.times(state.admin_fee).idiv(this.FEE_DENOMINATOR)),
    );
    // self.token.burnFrom(msg.sender, token_amount)  # dev: insufficient funds
    state.supply = state.supply.minus(token_amount);
    /* Original contract does the actual transfer here*/

    return dy;
  }

  handleRemoveLiquidityOne(event: any, state: PoolState, log: Log): PoolState {
    const _token_amount = bigNumberify(stringify(event.args.token_amount));
    const rates = this.getRates();
    const i = _.findIndex(
      this.COINS,
      c => c.toLowerCase() === this.lastTransferredCoin?.toLowerCase(),
    );
    if (i == -1) {
      this.logger.error(
        `Error: expected coin to have a transfer event before RemoveLiquidityOne event`,
      );
      return state;
    }
    this.remove_liquidity_one_coin(_token_amount, i, state);
    return state;
  }

  private get_y_D(
    A_: BigNumber,
    i: number,
    xp: BigNumber[],
    D: BigNumber,
  ): BigNumber {
    // Calculate x[i] if one reduces D from being calculated for xp to D
    // Done by solving quadratic equation iteratively.
    // x_1**2 + x1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
    // x_1**2 + b*x_1 = c
    // x_1 = (x_1**2 + c) / (2*x_1 + b)

    // x in the input is converted to the same price/precision

    // assert i >= 0  # dev: i below zero
    // assert i < N_COINS  # dev: i above N_COINS

    let c: BigNumber = D;
    let S_: BigNumber = BN_0;
    const Ann: BigNumber = A_.times(this.N_COINS);

    let _x: BigNumber = BN_0;
    for (let _i = 0; _i < this.N_COINS; _i++) {
      if (_i != i) {
        _x = xp[_i];
      } else {
        continue;
      }
      S_ = S_.plus(_x);
      c = c.times(D).idiv(_x.times(this.N_COINS));
    }
    c = c.times(D).idiv(Ann.times(this.N_COINS));
    const b: BigNumber = S_.plus(D.idiv(Ann));
    let y_prev: BigNumber = BN_0;
    let y: BigNumber = D;
    for (let _i = 0; _i < 255; _i++) {
      y_prev = y;
      y = y.times(y).plus(c).idiv(y.times(2).plus(b).minus(D));
      // Equality with the precision of 1
      if (y.gt(y_prev)) {
        if (y.minus(y_prev).lte(1)) {
          break;
        }
      } else {
        if (y_prev.minus(y).lte(1)) {
          break;
        }
      }
    }
    return y;
  }

  private _calc_withdraw_one_coin(
    _token_amount: BigNumber,
    i: number,
    amp: BigNumber,
    fee: BigNumber,
    supply: BigNumber,
    rates: BigNumber[],
    balances: BigNumber[],
  ) {
    // First, need to calculate
    // * Get current D
    // * Solve Eqn against y_i for D - _token_amount
    const _fee: BigNumber = fee
      .times(this.N_COINS)
      .idiv(4 * (this.N_COINS - 1));
    const precisions: BigNumber[] = _.clone(this.PRECISION_MUL);
    const total_supply: BigNumber = supply;

    const xp: BigNumber[] = this._xp(rates, balances);

    const D0: BigNumber = this.get_D(xp, amp);
    const D1: BigNumber = D0.minus(_token_amount.times(D0).idiv(total_supply));
    const xp_reduced: BigNumber[] = _.clone(xp);

    const new_y: BigNumber = this.get_y_D(amp, i, xp, D1);
    const dy_0: BigNumber = xp[i].minus(new_y).idiv(precisions[i]); // w/o fees

    for (let j = 0; j < this.N_COINS; j++) {
      let dx_expected: BigNumber = BN_0;
      if (j == i) {
        dx_expected = xp[j].times(D1).idiv(D0).minus(new_y);
      } else {
        dx_expected = xp[j].minus(xp[j].times(D1).idiv(D0));
      }
      xp_reduced[j] = xp_reduced[j].minus(
        _fee.times(dx_expected).idiv(this.FEE_DENOMINATOR),
      );
    }

    let dy: BigNumber = xp_reduced[i].minus(
      this.get_y_D(amp, i, xp_reduced, D1),
    );
    dy = dy.minus(1).idiv(precisions[i]); // Withdraw less to account for rounding errors

    return { dy, dy_fee: dy_0.minus(dy) };
  }

  public calc_token_amount(
    amounts: BigNumber[],
    deposit: boolean,
    state: Readonly<PoolState>,
  ): BigNumber {
    // """
    // Simplified method to calculate addition or reduction in token supply at
    // deposit or withdrawal without taking fees into account (but looking at
    // slippage).
    // Needed to prevent front-running, not for precise calculations!
    // """
    const _balances: BigNumber[] = state.balances.map(bigNumberify);
    const rates = this.getRates();
    const amp = bigNumberify(state.A);
    const D0 = this.get_D_mem(rates, _balances, amp);
    for (let i = 0; i < this.N_COINS; i++) {
      if (deposit) _balances[i] = _balances[i].plus(amounts[i]);
      else _balances[i] = _balances[i].minus(amounts[i]);
    }
    const D1 = this.get_D_mem(rates, _balances, amp);
    const token_amount = bigNumberify(state.supply);
    let diff: BigNumber;
    if (deposit) diff = D1.minus(D0);
    else diff = D0.minus(D1);
    return diff.times(token_amount).idiv(D0);
  }

  public calc_withdraw_one_coin(
    token_amount: BigNumber,
    i: number,
    state: Readonly<PoolState>,
  ): BigNumber {
    const rates = this.getRates();
    const { dy, dy_fee } = this._calc_withdraw_one_coin(
      token_amount,
      i,
      state.A,
      state.fee,
      state.supply,
      rates,
      state.balances,
    );
    return dy;
  }
}
