import { BigNumber, BytesLike, ethers } from 'ethers';
import { assert } from 'ts-essentials';
import { extractSuccessAndValue } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { DexConfigMap } from '../../types';
import {
  DexParams,DecodedGetReserves,DecodedGetImmutables,DecodedGetPriceAndNearestTicks,DecodedGetSecondsGrowthAndLastObservation,
  DecodedTicksData,DecodedLimitOrderTicksData,DecodedGetTickState,TickInfoMappingsWithBigNumber,LimitOrderTickInfoMappingsWithBigNumber
} from './types';
import { debug } from 'console';

export function getDfynV2DexKey(DfynV2Config: DexConfigMap<DexParams>) {
  const DfynV2Keys = Object.keys(DfynV2Config);
  if (DfynV2Keys.length !== 1) {
    throw new Error(
      `DfynV2 key in DfynV2Config is not unique. Update relevant places (optimizer) or fix config issue. Received: ${JSON.stringify(
        DfynV2Config,
        (_0, value) => (typeof value === 'bigint' ? value.toString() : value),
      )}`,
    );
  }

  return DfynV2Keys[0].toLowerCase();
}


export function decodeGetReserves(
  result: MultiResult<BytesLike> | BytesLike
  ) : DecodedGetReserves {
    const [isSuccess, toDecode] = extractSuccessAndValue(result);

    assert(
      isSuccess && toDecode !== '0x',
      `DecodedGetReserves failed to get decodable result: ${result}`,
    );

    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        `
        tuple(
          uint128 _reserve0,
          uint128 _reserve1
        )
      `,
      ],
      toDecode,
    )[0];
    return decoded as DecodedGetReserves;
}

  export function decodeGetImmutables(
    result: MultiResult<BytesLike> | BytesLike
    ) : DecodedGetImmutables {
      const [isSuccess, toDecode] = extractSuccessAndValue(result);
  
      assert(
        isSuccess && toDecode !== '0x',
        `DecodedGetImmutables failed to get decodable result: ${result}`,
      );
  
      const decoded = ethers.utils.defaultAbiCoder.decode(
        [
          `
          tuple(
            uint128 _MAX_TICK_LIQUIDITY,
            uint24 _tickSpacing,
            uint24 _swapFee,
            address _dfynFeeTo,
            address _vault,
            address _masterDeployer,
            address _token0,
            address _token1,
          )
        `,
        ],
        toDecode,
      )[0];
      return decoded as DecodedGetImmutables;
}

export function decodeGetPriceAndNearestTicks(
  result: MultiResult<BytesLike> | BytesLike
  ) : DecodedGetPriceAndNearestTicks {
    const [isSuccess, toDecode] = extractSuccessAndValue(result);

    assert(
      isSuccess && toDecode !== '0x',
      `DecodedGetPriceAndNearestTicks failed to get decodable result: ${result}`,
    );

    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        `
        tuple(
          uint160 _price,
          int24 _nearestTick
        )
      `,
      ],
      toDecode,
    )[0];
    return decoded as DecodedGetPriceAndNearestTicks;
}


export function decodeGetSecondsGrowthAndLastObservation(
  result: MultiResult<BytesLike> | BytesLike
  ) : DecodedGetSecondsGrowthAndLastObservation {
    const [isSuccess, toDecode] = extractSuccessAndValue(result);

    assert(
      isSuccess && toDecode !== '0x',
      `DecodedGetSecondsGrowthAndLastObservation failed to get decodable result: ${result}`,
    );

    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        `
        tuple(
          uint160 _secondsGrowthGlobal,
          uint32 _lastObservation
        )
      `,
      ],
      toDecode,
    )[0];
    return decoded as DecodedGetSecondsGrowthAndLastObservation;
}


export function decodeTicks(
  result: MultiResult<BytesLike> | BytesLike
  ) : DecodedTicksData {
    const [isSuccess, toDecode] = extractSuccessAndValue(result);

    assert(
      isSuccess && toDecode !== '0x',
      `DecodedTicksData failed to get decodable result: ${result}`,
    );
    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        `
          tuple(
            int24 previousTick,
            int24 nextTick,
            uint128 liquidity,
            uint256 feeGrowthOutside0,
            uint256 feeGrowthOutside1,
            uint160 secondsGrowthOutside,
          )
        `,
      ],
      toDecode,
    )[0];
    

    ticksData.push(decoded);
    
    return {ticks: ticksData} as DecodedTicksData;

}

const ticksData: TickInfoMappingsWithBigNumber[] = [];
export function decodeLimitOrderTicks(
  result: MultiResult<BytesLike> | BytesLike
  ) : DecodedLimitOrderTicksData {
    const [isSuccess, toDecode] = extractSuccessAndValue(result);

    assert(
      isSuccess && toDecode !== '0x',
      `DecodedLimitOrderTicksData failed to get decodable result: ${result}`,
    );
    
    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        `
        tuple(
          uint256 token0Liquidity,
          uint256 token1Liquidity,
          uint256 token0Claimable,
          uint256 token1Claimable,
          uint256 token0ClaimableGrowth,
          uint256 token1ClaimableGrowth,
          bool isActive,
        )
      `,
      ],
      toDecode,
    )[0];

    limitOrderTicksData.push(decoded);
    // console.log(limitOrderTicksData)
    return { limitOrderTicks: limitOrderTicksData} as DecodedLimitOrderTicksData;
    //return {limitOrderTicks: decoded} as DecodedLimitOrderTicksData;
}

const limitOrderTicksData : LimitOrderTickInfoMappingsWithBigNumber[] = []


export function decodeGetTickState(
  result: MultiResult<BytesLike> | BytesLike
  ) : DecodedGetTickState {
    
    const [isSuccess, toDecode] = extractSuccessAndValue(result);
    
    assert(
      isSuccess && toDecode !== '0x',
      `DecodedGetTickState failed to get decodable result: ${result}`,
    );

    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        `
        tuple(
          int24 index,
          uint128 liquidity
        )[]
      `,
      ],
      toDecode,
    );

    return {ticks: decoded} as DecodedGetTickState;
}
