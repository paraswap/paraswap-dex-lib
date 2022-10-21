import dotenv from 'dotenv';
dotenv.config();

import _ from 'lodash';
import { UniswapV3EventPool } from './uniswap-v3-pool';
import { UniswapV3Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { OracleObservation, PoolState, Slot0, TickInfo } from './types';
import { bigIntify } from '../../utils';
import { MultiResult } from '../../lib/multi-wrapper';
import { TickBitMap } from './contract-math/TickBitMap';

jest.setTimeout(300 * 1000);
const dexKey = 'UniswapV3';
const network = Network.MAINNET;
const config = UniswapV3Config[dexKey][network];

const TICK_BIT_MAP_START = -500;
const TICK_BIT_MAP_END = 500;
const TICK_BIT_MAP_REQUEST_AMOUNT = -TICK_BIT_MAP_START + TICK_BIT_MAP_END + 1;
const CHUNK_SIZE = 1;

async function fetchPoolState(
  uniswapV3Pool: UniswapV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `UniswapV3: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Because in pool implementation to receive state we use special StateMulticall,
  // but for the old blocks it was not existed, I could not use it to query state.
  // So in the end of this file I wrote the long redundant things to query the state
  // Please don't consider it as a practice which may be replicated.
  // Here should be either subgraph call or use internal generateState function
  const state = await getStateFromMulticall(uniswapV3Pool, blockNumber);
  console.log(`Done ${message}`);
  return state;
}

describe('UniswapV3 Event', function () {
  const poolAddress = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
  const poolFeeCode = 500n;
  const token0 = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

  const blockNumbers: { [eventName: string]: number[] } = {
    // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
    ['Swap']: [
      14973668, 14973666, 14973665, 14973664, 14973663, 14973662, 14973661,
    ],
    // topic0 - 0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c
    ['Burn']: [14973650, 14973586, 14973558, 14973552, 14973547],
    // topic0 - 0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde
    ['Mint']: [14973657, 14973641, 14973619, 14973589, 14973552],
    // topic0 - 0x973d8d92bb299f4af6ce49b52a8adb85ae46b9f214c4c4fc06ac77401237b133
    ['SetFeeProtocol']: [],
    // topic0 - 0xac49e518f90a358f652e4400164f05a5d8f7e35e7747279bc3a93dbf584e125a
    ['IncreaseObservationCardinalityNext']: [13125816, 12733621, 12591465],
  };

  describe('UniswapV3EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          const uniswapV3Pool = new UniswapV3EventPool(
            dexHelper,
            dexKey,
            config.stateMulticall,
            config.factory,
            poolFeeCode,
            token0,
            token1,
            logger,
          );

          // It is done in generateState. But here have to make it manually
          uniswapV3Pool.poolAddress = poolAddress.toLowerCase();
          uniswapV3Pool.addressesSubscribed[0] = poolAddress;

          await testEventSubscriber(
            uniswapV3Pool,
            uniswapV3Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(uniswapV3Pool, _blockNumber, poolAddress),
            blockNumber,
            `${dexKey}_${poolAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});

function _getFirstStepStateCallData(uniswapV3Pool: UniswapV3EventPool) {
  const target = uniswapV3Pool.poolAddress;

  return [
    {
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData('slot0', []),
    },
    {
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData('liquidity', []),
    },
    {
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData('fee', []),
    },
    {
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData('tickSpacing', []),
    },
    {
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData(
        'maxLiquidityPerTick',
        [],
      ),
    },
  ];
}

function _getSecondStepStateCallData(
  uniswapV3Pool: UniswapV3EventPool,
  currentTickBitmap: bigint,
) {
  const target = uniswapV3Pool.poolAddress;
  const start = Number(
    currentTickBitmap - uniswapV3Pool.getBitmapRangeToRequest(),
  );
  const end = Number(
    currentTickBitmap + uniswapV3Pool.getBitmapRangeToRequest(),
  );

  return _.range(start, end).map(ind => ({
    target,
    callData: uniswapV3Pool.poolIface.encodeFunctionData('tickBitmap', [ind]),
  }));
}

function _getThirdStepStateCallData(
  uniswapV3Pool: UniswapV3EventPool,
  observationIndex: number,
  ticks: bigint[],
) {
  const target = uniswapV3Pool.poolAddress;
  return [
    {
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData('observations', [
        observationIndex,
      ]),
    },
  ].concat(
    ticks.map(tick => ({
      target,
      callData: uniswapV3Pool.poolIface.encodeFunctionData('ticks', [tick]),
    })),
  );
}

async function getStateFromMulticall(
  uniswapV3Pool: UniswapV3EventPool,
  blockNumber: number,
): Promise<PoolState> {
  const firstCallData = _getFirstStepStateCallData(uniswapV3Pool);

  const firstData = await uniswapV3Pool.dexHelper.multiContract.methods
    .tryAggregate(false, firstCallData)
    .call({}, blockNumber || 'latest');

  _checkMulticallResultForError(firstData, blockNumber);

  const slot0 = _decodeSlot0Result(uniswapV3Pool, firstData[0].returnData);
  const liquidity = bigIntify(
    uniswapV3Pool.poolIface.decodeFunctionResult(
      'liquidity',
      firstData[1].returnData,
    )[0],
  );
  const fee = bigIntify(
    uniswapV3Pool.poolIface.decodeFunctionResult(
      'fee',
      firstData[2].returnData,
    )[0],
  );
  const tickSpacing = bigIntify(
    uniswapV3Pool.poolIface.decodeFunctionResult(
      'tickSpacing',
      firstData[3].returnData,
    )[0],
  );
  const maxLiquidityPerTick = bigIntify(
    uniswapV3Pool.poolIface.decodeFunctionResult(
      'maxLiquidityPerTick',
      firstData[4].returnData,
    )[0],
  );

  const [currentTickBitmap] = TickBitMap.position(slot0.tick / tickSpacing);

  const secondCallData = _getSecondStepStateCallData(
    uniswapV3Pool,
    currentTickBitmap,
  );

  const secondData = await uniswapV3Pool.dexHelper.multiContract.methods
    .tryAggregate(false, secondCallData)
    .call({}, blockNumber || 'latest');

  _checkMulticallResultForError(secondData, blockNumber);

  let ind = Number(currentTickBitmap - uniswapV3Pool.getBitmapRangeToRequest());
  const tickBitmap = (
    secondData.map((d: MultiResult<string>) =>
      bigIntify(
        uniswapV3Pool.poolIface.decodeFunctionResult(
          'tickBitmap',
          d.returnData,
        )[0],
      ),
    ) as bigint[]
  ).reduce<Record<string, bigint>>((acc, curr) => {
    acc[ind++] = curr;
    return acc;
  }, {});

  const populatedTickIndexes = _calcPopulatedTickIndexes(
    Object.values(tickBitmap),
    tickSpacing,
  );

  const thirdCallData = _getThirdStepStateCallData(
    uniswapV3Pool,
    slot0.observationIndex,
    populatedTickIndexes,
  );

  const thirdData = await uniswapV3Pool.dexHelper.multiContract.methods
    .tryAggregate(false, thirdCallData)
    .call({}, blockNumber || 'latest');

  _checkMulticallResultForError(thirdData, blockNumber);

  const observations: Record<number, OracleObservation> = {};

  observations[slot0.observationIndex] = _decodeObservationResult(
    uniswapV3Pool,
    thirdData[0].returnData,
  );

  const ticks = populatedTickIndexes.reduce<Record<string, TickInfo>>(
    (acc, curr, i) => {
      acc[curr.toString()] = _decodeTickInfoResult(
        uniswapV3Pool,
        thirdData[i + 1].returnData,
      );
      return acc;
    },
    {},
  );
  const blockTimestamp = BigInt(
    (
      await uniswapV3Pool.dexHelper.web3Provider.eth.getBlock(
        blockNumber || 'latest',
      )
    ).timestamp,
  );

  const requestedRange = uniswapV3Pool.getBitmapRangeToRequest();

  return {
    pool: uniswapV3Pool.poolAddress,
    blockTimestamp,
    slot0,
    liquidity,
    fee,
    tickSpacing,
    maxLiquidityPerTick,
    tickBitmap,
    ticks,
    observations,
    isValid: true,
    startTickBitmap: currentTickBitmap,
    lowestKnownTick:
      (BigInt.asIntN(24, currentTickBitmap - requestedRange) << 8n) *
      tickSpacing,
    highestKnownTick:
      ((BigInt.asIntN(24, currentTickBitmap + requestedRange) << 8n) +
        BigInt.asIntN(24, 255n)) *
      tickSpacing,
  };
}

function _decodeSlot0Result(
  uniswapV3Pool: UniswapV3EventPool,
  data: string,
): Slot0 {
  const _slot0 = uniswapV3Pool.poolIface.decodeFunctionResult('slot0', data);
  return {
    sqrtPriceX96: bigIntify(_slot0.sqrtPriceX96),
    tick: bigIntify(_slot0.tick),
    observationIndex: _slot0.observationIndex,
    observationCardinality: _slot0.observationCardinality,
    observationCardinalityNext: _slot0.observationCardinalityNext,
    feeProtocol: bigIntify(_slot0.feeProtocol),
  };
}

function _decodeObservationResult(
  uniswapV3Pool: UniswapV3EventPool,
  data: string,
): OracleObservation {
  const observation = uniswapV3Pool.poolIface.decodeFunctionResult(
    'observations',
    data,
  );
  return {
    blockTimestamp: bigIntify(observation.blockTimestamp),
    tickCumulative: bigIntify(observation.tickCumulative),
    secondsPerLiquidityCumulativeX128: bigIntify(
      observation.secondsPerLiquidityCumulativeX128,
    ),
    initialized: observation.initialized,
  };
}

function _decodeTickInfoResult(
  uniswapV3Pool: UniswapV3EventPool,
  data: string,
): TickInfo {
  const tickInfo = uniswapV3Pool.poolIface.decodeFunctionResult('ticks', data);
  return {
    liquidityGross: bigIntify(tickInfo.liquidityGross),
    liquidityNet: bigIntify(tickInfo.liquidityNet),
    tickCumulativeOutside: bigIntify(tickInfo.tickCumulativeOutside),
    secondsPerLiquidityOutsideX128: bigIntify(
      tickInfo.secondsPerLiquidityOutsideX128,
    ),
    secondsOutside: bigIntify(tickInfo.secondsOutside),
    initialized: tickInfo.initialized,
  };
}

function _calcPopulatedTickIndexes(
  tickBitmaps: bigint[],
  tickSpacing: bigint,
): bigint[] {
  return tickBitmaps.reduce<bigint[]>((acc, curr, tickBitmapIndex) => {
    if (curr !== 0n) {
      for (let i = 0n; i < 256n; i++) {
        if ((curr & (1n << i)) > 0n) {
          const populatedTick =
            ((BigInt(tickBitmapIndex) << 8n) + i) * tickSpacing;
          acc.push(populatedTick);
        }
      }
    }
    return acc;
  }, []);
}

function _checkMulticallResultForError(
  data: MultiResult<string>[],
  blockNumber: number,
) {
  data.forEach((d: MultiResult<string>, i: number) => {
    if (!d.success) {
      throw new Error(
        `UniswapV3: Can not fetch state for ${blockNumber} and index=${i}`,
      );
    }
  });
}
