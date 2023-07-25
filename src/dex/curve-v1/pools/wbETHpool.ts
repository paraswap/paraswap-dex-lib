import { Address, Log } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify, catchParseLogError, stringify } from '../../../utils';
import StableSwapWBETH from '../../../abi/curve-v1/StableSwapWBETH.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, BN_2 } from '../../../bignumber-constants';
import _ from 'lodash';
import { CurvePool, PoolState } from './curve-pool';
import { DeepReadonly } from 'ts-essentials';

const pool = 'wbETH';
export const address: Address =
  '0xbfab6fa95e0091ed66058ad493189d2cb29385e6'.toLowerCase();
const tokenAddress: Address = '0xbfab6fa95e0091ed66058ad493189d2cb29385e6';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const A_PRECISION = bigNumberify(100);
const USE_LENDING = [false, false];
const ADMIN_FEE = bigNumberify(5000000000);
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xa2e3356610840701bdf5611a53974510ae27e2e1',
];
const trackCoins = true;

export class WBETHPool extends CurvePool {
  public isAdminBalancesSupported: boolean = true;

  lastTransferredCoin?: Address;

  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapWBETH,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    prefix = 'WBETHPool',
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
    this.handlers['CommitNewFee'] = this.handleNewFee.bind(this);
    this.handlers['Transfer'] = this.handleCoinTransfer.bind(this);
  }

  public processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    let _state: PoolState = {
      A: bigNumberify(state.A),
      fee: bigNumberify(state.fee),
      admin_fee: bigNumberify(state.admin_fee),
      supply: bigNumberify(state.supply),
      balances: state.balances.map(bigNumberify),
      eth_balance: bigNumberify(state.eth_balance),
      token_balance: bigNumberify(state.token_balance),
      stored_rates: state.stored_rates!.map(bigNumberify),
      admin_balances: state.admin_balances!.map(bigNumberify),
    };
    try {
      const event = this.decoder(log);

      if (event.name in this.handlers) {
        return this.handlers[event.name](event, _state, log);
      }
      return _state;
    } catch (e) {
      catchParseLogError(e, this.logger);
    }
    return _state;
  }

  handleCoinTransfer(event: any, state: PoolState, log: Log): PoolState {
    const from = event.args.src;
    const coin = log.address;

    if (from.toLowerCase() === this.address.toLowerCase())
      this.lastTransferredCoin = coin.toLowerCase();
    return state;
  }

  handleRemoveLiquidityOne(event: any, state: PoolState, log: Log): PoolState {
    const _token_amount = bigNumberify(stringify(event.args.token_amount));
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

  handleNewFee(event: any, state: PoolState, log: Log): PoolState {
    const fee = bigNumberify(stringify(event.args.new_fee));

    state.fee = fee;
    return state;
  }

  handleRemoveLiquidity(event: any, state: PoolState, log: Log): PoolState {
    const token_supply = bigNumberify(stringify(event.args.token_supply));
    const amounts = event.args.token_amounts
      .map(stringify)
      .map(bigNumberify);

    for (let i = 0; i < this.N_COINS; i++) {
      if(i === 0) {
        state.eth_balance = state.eth_balance?.minus(amounts[i]);
      } else {
        state.token_balance = state.token_balance!.minus(amounts[i]);
      }
    }

    state.supply = token_supply;
    return state;
  }

  handleRemoveLiquidityImbalances(
    event: any,
    state: PoolState,
    log: Log,
  ): PoolState {
    const amounts = event.args.token_amounts.map(stringify).map(bigNumberify);
    const { A, stored_rates: rates, balances, fee, supply: total_supply } = state;
    const amp = A.times(A_PRECISION);

    const old_balances = this._balances(state);
    const D0 = this.get_D_mem(rates!, old_balances, amp);
    let new_balances = _.clone(old_balances);

    for (let i = 0; i < this.N_COINS; i++) {
      new_balances[i] = new_balances[i].minus(amounts[i]);
    }

    const D1 = this.get_D_mem(rates!, new_balances, amp);

    const fees: BigNumber[] = new Array<BigNumber>(this.N_COINS);
    const base_fee = fee.times(this.N_COINS).idiv(4 * (this.N_COINS - 1));

    for (let i = 0; i < this.N_COINS; i++) {
      const ideal_balance: BigNumber = D1.times(old_balances[i]).idiv(D0);
      let difference: BigNumber = BN_0;
      const new_balance = new_balances[i];
      if (ideal_balance.gt(new_balance)) {
        difference = ideal_balance.minus(new_balances[i]);
      } else {
        difference = new_balances[i].minus(ideal_balance);
      }
      fees[i] = base_fee.times(difference).idiv(this.FEE_DENOMINATOR);
      state.admin_balances![i] = state.admin_balances![i].plus(fees[i].times(ADMIN_FEE).idiv(this.FEE_DENOMINATOR));
      new_balances[i] = new_balances[i].minus(fees[i]);
    }
    new_balances = this._xp_mem(rates!, new_balances);
    const D2 = this.get_D(new_balances, amp);

    const burn_amount = D0.minus(D2).times(total_supply).idiv(D0).plus(1);
    state.supply = state.supply.minus(burn_amount);

    if(! amounts[0].eq(BN_0)) {
      state.eth_balance = state.eth_balance!.minus(amounts[0]);
    }

    if(! amounts[1].eq(BN_0)) {
      state.token_balance = state.token_balance!.minus(amounts[1]);
    }

    return state;
  }

  exchange(i: number, j: number, dx: BigNumber, state: PoolState): BigNumber {
    this.logger.info(`CurveV1: wbETH pool exchange before state: ${JSON.stringify(state)}`);

    const rates = state.stored_rates;

    let msgValue;
    if(i === 0) {
      msgValue = bigNumberify(dx);
    } else {
      msgValue = BN_0;
    }

    this.logger.info(`CurveV1: wbETH pool exchange msg value: ${msgValue}`);

    const old_balances: BigNumber[] = this._balances(state, msgValue);
    const xp: BigNumber[] = this._xp_mem(rates!, old_balances);

    const x: BigNumber = xp[i].plus(dx.times(rates![i]).idiv(this.PRECISION));
    const y = this._get_y(i, j, x, xp, state.A);

    let dy = xp[j].minus(y).minus(1);
    const dy_fee = dy.times(state.fee).idiv(this.FEE_DENOMINATOR);

    dy = dy.minus(dy_fee).times(this.PRECISION).idiv(rates![j]);

    xp[i] = x;
    xp[j] = y;

    const dy_admin_fee = dy_fee.times(ADMIN_FEE).idiv(this.FEE_DENOMINATOR).times(this.PRECISION).idiv(rates![j]);
    if(!dy_admin_fee.eq(BN_0)) {
      state.admin_balances![j] = state.admin_balances![j].plus(dy_admin_fee);
    }

    if(i === 0) {
      state.eth_balance = state.eth_balance!.minus(dy);
    } else {
      state.token_balance = state.token_balance!.minus(dx);
    }

    this.logger.info(`CurveV1: wbETH pool exchange after state: ${JSON.stringify(state)}`);

    return dy;
  }

  private _balances(state: PoolState, value: BigNumber = BN_0): BigNumber[] {
    const { admin_balances, eth_balance, token_balance } = state;

    state.balances = [
      eth_balance!.minus(admin_balances![0]).minus(value),
      token_balance!.minus(admin_balances![1]),
    ];

    return state.balances;
  }

  public get_dy(
    i: number,
    j: number,
    dx: BigNumber,
    state: Readonly<PoolState>,
  ): BigNumber {
    const { stored_rates: rates } = state;
    this.logger.info(`CurveV1: wbETH pool get_dy state: ${JSON.stringify(state)}`);
    return this._get_dy(
      i,
      j,
      dx,
      bigNumberify(state.A),
      bigNumberify(state.fee),
      this._balances(state),
      rates!,
    );
  }

  public _get_dy(
    i: number,
    j: number,
    dx: BigNumber,
    A: BigNumber,
    fee: BigNumber,
    balances: BigNumber[],
    rates: BigNumber[],
    usefee = true,
  ): BigNumber {
    const xp = this._xp_mem(rates, balances);
    const x = xp[i].plus(dx.times(rates[i]).idiv(this.PRECISION));
    const y = this._get_y(i, j, x, xp, A);
    const dy = xp[j].minus(y).minus(BN_1);
    const _fee = fee.times(dy).idiv(this.FEE_DENOMINATOR);

    return dy.minus(_fee).times(this.PRECISION).idiv(rates[j]);
  }

  protected _xp_mem(_rates: BigNumber[], _balances: BigNumber[]): BigNumber[] {
    const result = new Array(N_COINS).fill(0n);
    for (const i of _.range(Number(N_COINS))) {
      result[i] = _rates[i].times(_balances[i]).idiv(this.PRECISION);
    }
    return result;
  }

  _get_y(
    i: number,
    j: number,
    x: BigNumber,
    xp: BigNumber[],
    A: BigNumber,
  ): BigNumber {
    let S_ = BN_0;
    let _x = BN_0;
    const amp = A.times(A_PRECISION);
    const D = this._get_D(xp, amp);
    let c = bigNumberify(D);
    let y_prev = BN_0;
    const Ann = amp.times(this.N_COINS);

    for (const _i of _.range(N_COINS)) {
      if (_i === i) {
        _x = bigNumberify(x);
      } else if (_i !== j) {
        _x = bigNumberify(xp[_i]);
      } else {
        continue;
      }
      S_ = S_.plus(_x);
      c = c.times(D).idiv(_x.times(this.N_COINS)); // c = c * D / (_x * N_COINS)
    }
    // c = c * D * A_PRECISION / (Ann * N_COINS)
    c = c.times(D).times(A_PRECISION).idiv(Ann.times(this.N_COINS));
    // b: uint256 = S_ + D * A_PRECISION / Ann  # - D
    const b = S_.plus(D.times(A_PRECISION).idiv(Ann));
    let y = bigNumberify(D);

    for (const _i of _.range(255)) {
      y_prev = bigNumberify(y);
      y = y.times(y).plus(c).idiv(BN_2.times(y).plus(b).minus(D)); // y = (y*y + c) / (2 * y + b - D)

      // Equality with the precision of 1
      if (y > y_prev) {
        if (y.minus(y_prev).lte(1)) {
          return y;
        }
      } else {
        if (y_prev.minus(y).lte(1)) {
          return y;
        }
      }
    }

    throw Error('Error when calculate y');
  }

  add_liquidity(amounts: BigNumber[], state: PoolState): BigNumber {
    const { stored_rates: rates, A, supply, fee } = state;

    const msgValue = amounts[0];

    const old_balances = this._balances(state, msgValue);
    const amp = A.times(A_PRECISION);

    const D0 = this.get_D_mem(rates!, old_balances, amp);
    let total_supply = supply;
    const new_balances = old_balances.slice(0);

    for (let i = 0; i < this.N_COINS; i++) {
      const amount: BigNumber = amounts[i];
      new_balances[i] = new_balances[i].plus(amount);
    }

    const D1 = this.get_D_mem(rates!, new_balances, amp);
    const fees = new Array(N_COINS).fill(0n);
    let mint_amount = BN_0;

    if (total_supply.gt(BN_0)) {
      const base_fee = fee.times(this.N_COINS).idiv(4 * (this.N_COINS - 1));
      for (let i = 0; i < this.N_COINS; i++) {
        const ideal_balance: BigNumber = D1.times(old_balances[i]).idiv(D0);
        let difference = BN_0;
        const new_balance = new_balances[i];
        if(ideal_balance.gt(new_balance)) {
          difference = ideal_balance.minus(new_balance);
        } else {
          difference = new_balance.minus(ideal_balance);
        }
        fees[i] = base_fee.times(difference).idiv(this.FEE_DENOMINATOR);
        state.admin_balances![i] = state.admin_balances![i].plus(fees[i].times(ADMIN_FEE).idiv(this.FEE_DENOMINATOR));
        new_balances[i] = new_balances[i].minus(fees[i]);
      }
      const xp = this._xp_mem(rates!, new_balances);
      const D2 = this.get_D(xp, amp);
      mint_amount = total_supply.times(D2.minus(D0)).idiv(D0);
    } else {
      mint_amount = D1;
    }

    if(amounts[1].gt(0)) {
      state.token_balance = state.token_balance!.plus(amounts[1]);
    }

    total_supply = total_supply.plus(mint_amount);
    state.supply = total_supply;

    return mint_amount;
  }

  remove_liquidity_one_coin(
    token_amount: BigNumber,
    i: number,
    state: PoolState,
  ): BigNumber {
    let { dy } = this._calc_withdraw_one_coin(
      token_amount,
      i,
      state,
    );

    state.admin_balances![i] = state.admin_balances![i].plus(dy[1].times(ADMIN_FEE).idiv(this.FEE_DENOMINATOR));
    const total_supply = state.supply.minus(token_amount);
    state.supply = total_supply;

    if(i === 0) {
      state.eth_balance = state.eth_balance!.minus(dy[0]);
    } else {
      state.token_balance = state.token_balance!.minus(dy[0]);
    }

    return dy[0];
  }

  private _calc_withdraw_one_coin(
    _token_amount: BigNumber,
    i: number,
    state: PoolState,
  ) {
    const { A, fee, supply, stored_rates: rates } = state;

    const amp = A.times(A_PRECISION);
    const xp = this._xp_mem(rates!, this._balances(state));
    const D0 = this._get_D(xp, amp);

    const total_supply = supply;
    const D1 = D0.minus(_token_amount).idiv(total_supply);
    const new_y = this.get_y_D(amp, i, xp, D1);

    const base_fee = fee.times(this.N_COINS).idiv(4 * (this.N_COINS - 1));
    let xp_reduced = new Array(N_COINS).fill(0n);

    for (const j of _.range(N_COINS)) {
      let dx_expected = BN_0;
      const xp_j = xp[j];
      if(j == i) {
        dx_expected = xp_j.times(D1).idiv(D0).minus(new_y);
      } else {
        dx_expected = xp_j.minus(xp_j.times(D1).idiv(D0));
      }
      xp_reduced[j] = xp_j.minus(base_fee.times(dx_expected).idiv(this.FEE_DENOMINATOR));
    }

    let dy = xp_reduced[i].minus(this.get_y_D(amp, i, xp_reduced, D1));
    const dy_0 = xp[i].minus(new_y).times(this.PRECISION).idiv(rates![i]);
    dy = dy.minus(1).times(this.PRECISION).idiv(rates![i]);

    return { dy, dy_fee: dy_0.minus(dy) };
  }

  private get_y_D(
    A_: BigNumber,
    i: number,
    xp: BigNumber[],
    D: BigNumber,
  ): BigNumber {
    let c: BigNumber = D;
    let S_: BigNumber = BN_0;
    const Ann: BigNumber = A_.times(this.N_COINS);

    let _x: BigNumber = BN_0;
    for (let _i = 0; _i < this.N_COINS; _i++) {
      if (_i !== i) {
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

  _get_D(xp: BigNumber[], amp: BigNumber): BigNumber {
    let S = BN_0;
    for (const _x of xp) {
      S = S.plus(_x);
    }
    if (S.eq(BN_0)) {
      return BN_0;
    }

    let D = bigNumberify(S);
    const Ann = amp.times(this.N_COINS);
    for (const _i of _.range(255)) {
      let D_P = D.times(D)
        .idiv(xp[0])
        .times(D)
        .idiv(xp[1])
        .idiv(this.N_COINS ** 2); // D_P: uint256 = D * D / _xp[0] * D / _xp[1] / (N_COINS)**2

      let Dprev = bigNumberify(D);

      const dividend = Ann.times(S)
        .idiv(A_PRECISION)
        .plus(D_P.times(this.N_COINS))
        .times(D);
      const divisor = Ann.minus(A_PRECISION)
        .times(D)
        .idiv(A_PRECISION)
        .plus(D_P.times(this.N_COINS + 1));
      D = dividend.idiv(divisor); // D = (Ann * S / A_PRECISION + D_P * N_COINS) * D / ((Ann - A_PRECISION) * D / A_PRECISION + (N_COINS + 1) * D_P)

      if (D.gt(Dprev)) {
        if (D.minus(Dprev).lte(1)) {
          return D;
        }
      } else {
        if (Dprev.minus(D).lte(1)) {
          return D;
        }
      }
    }

    throw Error('Error when calcucate D');
  }
}
