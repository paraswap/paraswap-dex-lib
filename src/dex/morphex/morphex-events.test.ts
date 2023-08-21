import dotenv from 'dotenv';
dotenv.config();

import { GMXEventPool } from '../gmx/pool';
import { MorphexConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from '../gmx/types';

jest.setTimeout(50 * 1000);
const dexKey = 'Morphex';
const network = Network.FANTOM;
const params = MorphexConfig[dexKey][network];

async function fetchPoolState(
  gmxPool: GMXEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return gmxPool.generateState(blockNumber);
}

// timestamp can't be compared exactly as the event released
// doesn't have the timestamp. It is safe to consider the
// timestamp as the blockTime as the max deviation is bounded
// on the contract
const stateWithoutTimestamp = (state: PoolState) => ({
  ...state,
  secondaryPrices: {
    prices: state.secondaryPrices.prices,
    // timestamp (this is removed)
  },
});

function compareState(state: PoolState, expectedState: PoolState) {
  expect(stateWithoutTimestamp(state)).toEqual(
    stateWithoutTimestamp(expectedState),
  );
}

describe('Morphex Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdgAmount: [
      67247602, 67247565, 67247561, 67247508, 67247393, 67247305, 67247303,
      67247302, 67247230, 67247220, 67247218, 67247216, 67247215, 67247145,
      67247059, 67247026, 67246788, 67246731,
    ],
    DecreaseUsdgAmount: [
      67247778, 67247602, 67247565, 67247561, 67247508, 67247393, 67247305,
      67247303, 67247302, 67247230, 67247220, 67247218, 67247216, 67247215,
      67247145, 67247059, 67247026, 67246788,
    ],
    Transfer: [
      67087282, 67087063, 67087039, 67068002, 67052880, 67052806, 67052801,
    ],
    PriceUpdate: [67248035, 67247977, 67247907, 67247897, 67247893],
  };

  describe('MorphexEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await GMXEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );
          const gmxPool = new GMXEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

          await testEventSubscriber(
            gmxPool,
            gmxPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(gmxPool, _blockNumber),
            blockNumber,
            `${dexKey}_${params.vault}`,
            dexHelper.provider,
            compareState,
          );
        });
      });
    });
  });
});
