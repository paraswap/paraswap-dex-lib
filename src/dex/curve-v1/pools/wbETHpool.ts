import { Address } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { ThreePool } from './3pool';
import StableSwapWBETH from '../../../abi/curve-v1/StableSwapWBETH.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, BN_2 } from '../../../bignumber-constants';
import _ from 'lodash';
import { PoolState } from './curve-pool';

const pool = 'wbETH';
export const address: Address =
  '0xbfab6fa95e0091ed66058ad493189d2cb29385e6'.toLowerCase();
const tokenAddress: Address = '0xbfab6fa95e0091ed66058ad493189d2cb29385e6';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const A_PRECISION = bigNumberify(100);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xa2e3356610840701bdf5611a53974510ae27e2e1',
];
const trackCoins = true;

export class WBETHPool extends ThreePool {
  public isStoredRatesSupported: boolean = true;

  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapWBETH,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'WBETHPool',
    );
  }

  public get_dy(
    i: number,
    j: number,
    dx: BigNumber,
    state: Readonly<PoolState>,
  ): BigNumber {
    const { stored_rates: rates } = state;
    return this._get_dy(
      i,
      j,
      dx,
      bigNumberify(state.A),
      bigNumberify(state.fee),
      state.balances.map(bigNumberify),
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
