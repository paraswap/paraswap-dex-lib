import { BI_MAX_UINT256 } from '../../../bigint-constants';
import { boolToBigint, _require } from './utils';

export class TickMath {
  static readonly MIN_TICK = -887272n;
  static readonly MAX_TICK = -TickMath.MIN_TICK;
  static readonly MIN_SQRT_RATIO = 4295128739n;
  static readonly MAX_SQRT_RATIO =
    1461446703485210103287273052203988822378723970342n;

  static getSqrtRatioAtTick(tick: bigint): bigint {
    const absTick = tick < 0n ? -tick : tick;
    _require(
      absTick <= TickMath.MAX_TICK,
      'T',
      { absTick },
      'absTick <= TickMath.MAX_TICK',
    );

    let ratio =
      absTick & boolToBigint(BigInt('0x1') !== 0n)
        ? BigInt('0xfffcb933bd6fad37aa2d162d1a594001')
        : BigInt('0x100000000000000000000000000000000');
    if (absTick & boolToBigint(BigInt('0x2') !== 0n))
      ratio = (ratio * BigInt('0xfff97272373d413259a46990580e213a')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x4') !== 0n))
      ratio = (ratio * BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x8') !== 0n))
      ratio = (ratio * BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x10') !== 0n))
      ratio = (ratio * BigInt('0xffcb9843d60f6159c9db58835c926644')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x20') !== 0n))
      ratio = (ratio * BigInt('0xff973b41fa98c081472e6896dfb254c0')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x40') !== 0n))
      ratio = (ratio * BigInt('0xff2ea16466c96a3843ec78b326b52861')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x80') !== 0n))
      ratio = (ratio * BigInt('0xfe5dee046a99a2a811c461f1969c3053')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x100') !== 0n))
      ratio = (ratio * BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x200') !== 0n))
      ratio = (ratio * BigInt('0xf987a7253ac413176f2b074cf7815e54')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x400') !== 0n))
      ratio = (ratio * BigInt('0xf3392b0822b70005940c7a398e4b70f3')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x800') !== 0n))
      ratio = (ratio * BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x1000') !== 0n))
      ratio = (ratio * BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x2000') !== 0n))
      ratio = (ratio * BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x4000') !== 0n))
      ratio = (ratio * BigInt('0x70d869a156d2a1b890bb3df62baf32f7')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x8000') !== 0n))
      ratio = (ratio * BigInt('0x31be135f97d08fd981231505542fcfa6')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x10000') !== 0n))
      ratio = (ratio * BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x20000') !== 0n))
      ratio = (ratio * BigInt('0x5d6af8dedb81196699c329225ee604')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x40000') !== 0n))
      ratio = (ratio * BigInt('0x2216e584f5fa1ea926041bedfe98')) >> 128n;
    if (absTick & boolToBigint(BigInt('0x80000') !== 0n))
      ratio = (ratio * BigInt('0x48a170391f7dc42444e8fa2')) >> 128n;

    if (tick > 0) ratio = BI_MAX_UINT256 / ratio;
    return (ratio >> 32n) + (ratio % (1n << 32n) == 0n ? 0n : 1n);
  }

  static getTickAtSqrtRatio(sqrtPriceX96: bigint): bigint {
    _require(sqrtPriceX96 >= TickMath.MIN_SQRT_RATIO && sqrtPriceX96 < TickMath.MAX_SQRT_RATIO, 'R', {sqrtPriceX96}, 'sqrtPriceX96 >= TickMath.MIN_SQRT_RATIO && sqrtPriceX96 < TickMath.MAX_SQRT_RATIO');

    let ratio = sqrtPriceX96 << 32n;

        let r = ratio;
        let msb = 0n;

        assembly {
            let f := shl(7, gt(r, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := shl(6, gt(r, 0xFFFFFFFFFFFFFFFF))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := shl(5, gt(r, 0xFFFFFFFF))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := shl(4, gt(r, 0xFFFF))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := shl(3, gt(r, 0xFF))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := shl(2, gt(r, 0xF))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := shl(1, gt(r, 0x3))
            msb := or(msb, f)
            r := shr(f, r)
        }
        assembly {
            let f := gt(r, 0x1)
            msb := or(msb, f)
        }

        if (msb >= 128) r = ratio >> (msb - 127);
        else r = ratio << (127 - msb);

        int256 log_2 = (int256(msb) - 128) << 64;

        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(63, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(62, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(61, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(60, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(59, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(58, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(57, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(56, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(55, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(54, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(53, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(52, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(51, f))
            r := shr(f, r)
        }
        assembly {
            r := shr(127, mul(r, r))
            let f := shr(128, r)
            log_2 := or(log_2, shl(50, f))
        }

        int256 log_sqrt10001 = log_2 * 255738958999603826347141; // 128.128 number

        int24 tickLow = int24((log_sqrt10001 - 3402992956809132418596140100660247210) >> 128);
        int24 tickHi = int24((log_sqrt10001 + 291339464771989622907027621153398088495) >> 128);

        return tickLow ==- tickHi ? tickLow : getSqrtRatioAtTick(tickHi) <= sqrtPriceX96 ? tickHi : tickLow;
  }
}
