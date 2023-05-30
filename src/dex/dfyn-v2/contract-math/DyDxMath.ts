import { FullMath } from './FullMath';
import { UnsafeMath } from './UnsafeMath';

export class DyDxMath {
  static getDy(
    liquidity: bigint,
    priceLower: bigint,
    priceUpper: bigint,
    roundUp: boolean,
  ): bigint {
    if (roundUp) {
      return FullMath.mulDivRoundingUp(
        liquidity,
        priceUpper - priceLower,
        0x1000000000000000000000000n,
      );
    } else {
      return FullMath.mulDiv(
        liquidity,
        priceUpper - priceLower,
        0x1000000000000000000000000n,
      );
    }
  }

  static getDx(
    liquidity: bigint,
    priceLower: bigint,
    priceUpper: bigint,
    roundUp: boolean,
  ): bigint {
    if (roundUp) {
      return UnsafeMath.divRoundingUp(
        FullMath.mulDivRoundingUp(
          liquidity << 96n,
          priceUpper - priceLower,
          priceUpper,
        ),
        priceLower,
      );
    } else {
      return (
        FullMath.mulDiv(liquidity << 96n, priceUpper - priceLower, priceUpper) /
        priceLower
      );
    }
  }

  static getLiquidityForAmounts(
    priceLower: bigint,
    priceUpper: bigint,
    currentPrice: bigint,
    dy: bigint,
    dx: bigint,
  ): bigint {
    if (priceUpper <= currentPrice) {
      return FullMath.mulDiv(
        dy,
        0x1000000000000000000000000n,
        priceUpper - priceLower,
      );
    } else if (currentPrice <= priceLower) {
      return FullMath.mulDiv(
        dx,
        FullMath.mulDiv(priceLower, priceUpper, 0x1000000000000000000000000n),
        priceUpper - priceLower,
      );
    } else {
      const liquidity0 = FullMath.mulDiv(
        dx,
        FullMath.mulDiv(priceUpper, currentPrice, 0x1000000000000000000000000n),
        priceUpper - currentPrice,
      );
      const liquidity1 = FullMath.mulDiv(
        dy,
        0x1000000000000000000000000n,
        currentPrice - priceLower,
      );
      return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
    }
  }

  static getAmountsForLiquidity(
    priceLower: bigint,
    priceUpper: bigint,
    currentPrice: bigint,
    liquidityAmount: bigint,
    roundUp: boolean,
  ): [token0amount: bigint, token1amount: bigint] {
    let token0amount: bigint = 0n;
    let token1amount: bigint = 0n;
    if (priceUpper <= currentPrice) {
      // Only supply `token1` (`token1` is Y).
      token1amount = BigInt.asUintN(
        128,
        DyDxMath.getDy(liquidityAmount, priceLower, priceUpper, roundUp),
      );
    } else if (currentPrice <= priceLower) {
      // Only supply `token0` (`token0` is X).
      token0amount = BigInt.asUintN(
        128,
        DyDxMath.getDx(liquidityAmount, priceLower, priceUpper, roundUp),
      );
    } else {
      // Supply both tokens.
      token0amount = BigInt.asUintN(
        128,
        DyDxMath.getDx(liquidityAmount, currentPrice, priceUpper, roundUp),
      );
      token1amount = BigInt.asUintN(
        128,
        DyDxMath.getDy(liquidityAmount, priceLower, currentPrice, roundUp),
      );
    }
    return [token0amount, token1amount];
  }
}
