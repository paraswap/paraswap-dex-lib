import BigNumber from 'bignumber.js';
import { Address, Log } from '../../../types';
import StableSwapSUSD from '../../../abi/curve/StableSwapSUSD.json';
import { CurvePool, PoolState } from './curve-pool';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { stringify } from 'querystring';

const pool = 'sUSD';
export const address: Address =
  '0xA5407eAE9Ba41422680e2e00537571bcC53efBfD'.toLowerCase();
const tokenAddress: Address = '0xC25a3A3b969415c80451098fa907EC722572917F';
const N_COINS: number = 4;
const PRECISION_MUL = ['1', '1000000000000', '1000000000000', '1'].map(
  bigNumberify,
);
const USE_LENDING = [false, false, false, false];
const COINS = [
  '0x6b175474e89094c44da98b954eedeac495271d0f',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
];
const trackCoins = false;

export class SUSDPool extends CurvePool {
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapSUSD,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
  ) {
    super(
      parentName,
      dexHelper,
      dexHelper.getLogger('SUSDPool'),
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
    this.handlers['TokenExchange'] = this.handleTokenExchange.bind(this);
    this.handlers['TokenExchangeUnderlying'] =
      this.handleTokenExchangeUnderlying.bind(this);
  }

  handleRemoveLiquidityImbalances(
    event: any,
    state: PoolState,
    log: Log,
  ): PoolState {
    state = super.handleRemoveLiquidityImbalances(event, state, log);
    // This is a hack for sUSD and similar pools as for the handleRemoveLiquidityImbalances
    // the pool donot permorm `token_amount = token_amount.plus(1);` to where as other
    // pools to do that to avoid rounding errors
    state.supply = state.supply.plus(1); // Reverse the rouding error correction
    return state;
  }

  handleTokenExchange(event: any, state: PoolState, log: Log): PoolState {
    const i = event.args.sold_id.toNumber();
    const j = event.args.bought_id.toNumber();
    const dx = bigNumberify(stringify(event.args.tokens_sold));
    const rates = this.getRates();

    const dy: BigNumber = this._exchange(i, j, dx, rates, state);
    // The constract does the actual transfer here
    return state;
  }

  handleTokenExchangeUnderlying(
    event: any,
    state: PoolState,
    log: Log,
  ): PoolState {
    const i = event.args.sold_id.toNumber();
    const j = event.args.bought_id.toNumber();
    const dx = bigNumberify(stringify(event.args.tokens_sold));
    const rates = this.getRates();

    const precisions: BigNumber[] = PRECISION_MUL;
    const rate_i: BigNumber = rates[i].idiv(precisions[i]);
    // const rate_j: BigNumber = rates[j].idiv(precisions[j]);
    const dx_: BigNumber = dx.times(this.PRECISION).idiv(rate_i);

    const dy_: BigNumber = this._exchange(i, j, dx_, rates, state);
    // The constract does the actual transfer here
    return state;
  }

  private _exchange(
    i: number,
    j: number,
    dx: BigNumber,
    rates: BigNumber[],
    state: PoolState,
  ): BigNumber {
    const xp: BigNumber[] = this._xp(rates, state.balances);

    const x: BigNumber = xp[i].plus(dx.times(rates[i]).idiv(this.PRECISION));
    const y: BigNumber = this.get_y(i, j, x, xp, state.A);
    const dy: BigNumber = xp[j].minus(y);
    const dy_fee: BigNumber = dy.times(state.fee).idiv(this.FEE_DENOMINATOR);
    const dy_admin_fee: BigNumber = dy_fee
      .times(state.admin_fee)
      .idiv(this.FEE_DENOMINATOR);
    state.balances[i] = x.times(this.PRECISION).idiv(rates[i]);
    state.balances[j] = y
      .plus(dy_fee.minus(dy_admin_fee))
      .times(this.PRECISION)
      .idiv(rates[j]);

    const _dy: BigNumber = dy
      .minus(dy_fee)
      .times(this.PRECISION)
      .idiv(rates[j]);

    return _dy;
  }
}
