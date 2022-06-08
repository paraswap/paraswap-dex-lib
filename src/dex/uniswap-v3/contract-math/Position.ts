import { ethers } from 'ethers';
import { Address } from '../../../types';
import { PoolState, PositionInfo } from '../types';
import { FixedPoint128 } from './FixedPoint128';
import { FullMath } from './FullMath';
import { LiquidityMath } from './LiquidityMath';
import { _require } from '../../../utils';

export class Position {
  static get(
    state: PoolState,
    owner: Address,
    tickLower: bigint,
    tickUpper: bigint,
  ) {
    const key = ethers.utils.solidityKeccak256(
      ['address', 'int24', 'int24'],
      [owner, tickLower.toString(), tickUpper.toString()],
    );
    return state.positions[key];
  }

  static update(
    self: PositionInfo,
    liquidityDelta: bigint,
    feeGrowthInside0X128: bigint,
    feeGrowthInside1X128: bigint,
  ) {
    const _self = self;

    let liquidityNext = 0n;
    if (liquidityDelta == 0n) {
      _require(
        _self.liquidity > 0n,
        'NP',
        { _selfLiquidity: _self.liquidity },
        '_self.liquidity > 0n',
      );
      liquidityNext = _self.liquidity;
    } else {
      liquidityNext = LiquidityMath.addDelta(_self.liquidity, liquidityDelta);
    }

    const tokensOwed0 = FullMath.mulDiv(
      feeGrowthInside0X128 - _self.feeGrowthInside0LastX128,
      _self.liquidity,
      FixedPoint128.Q128,
    );
    const tokensOwed1 = FullMath.mulDiv(
      feeGrowthInside1X128 - _self.feeGrowthInside1LastX128,
      _self.liquidity,
      FixedPoint128.Q128,
    );

    if (liquidityDelta != 0n) self.liquidity = liquidityNext;
    self.feeGrowthInside0LastX128 = feeGrowthInside0X128;
    self.feeGrowthInside1LastX128 = feeGrowthInside1X128;

    if (tokensOwed0 > 0n || tokensOwed1 > 0n) {
      self.tokensOwed0 += tokensOwed0;
      self.tokensOwed1 += tokensOwed1;
    }
  }
}
