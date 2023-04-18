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
      59651732, 59651743, 59651861, 59651866, 59651867, 59651930, 59651936,
      59651997, 59651998, 59652002, 59652008, 59652009, 59652031, 59652043,
      59652050, 59652106, 59652124, 59652298, 59652408, 59652433, 59652513,
      59652560,
    ],
    DecreaseUsdgAmount: [
      59651732, 59651743, 59651861, 59651866, 59651867, 59651930, 59651936,
      59651997, 59651998, 59652002, 59652008, 59652009, 59652031, 59652043,
      59652050, 59652106, 59652124, 59652298, 59652408, 59652433, 59652513,
      59652560, 59653097,
    ],
    Transfer: [
      59629746, 59630399, 59636919, 59642168, 59645873, 59647620, 59647620,
    ],
    PriceUpdate: [
      59654160, 59654320, 59654371, 59654438, 59654587, 59654606, 59654632,
      59654783, 59654800,
    ],
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
