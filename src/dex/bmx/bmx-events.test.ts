import dotenv from 'dotenv';
dotenv.config();

import { GMXEventPool } from '../gmx/pool';
import { BMXConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from '../gmx/types';

jest.setTimeout(50 * 1000);
const dexKey = 'Bmx';

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

describe('BMX Base Events', function () {
  const network = Network.BASE;
  const params = BMXConfig[dexKey][network];
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdgAmount: [
      5691895, 5691832, 5691529, 5691504, 5691456, 5691362, 5691195, 5691192,
      5691065, 5690868, 5690834, 5690820, 5690584, 5690163, 5689760, 5688633,
    ],
    DecreaseUsdgAmount: [
      5692222, 5691895, 5691832, 5691504, 5691456, 5691362, 5691195, 5691192,
      5691065, 5690868, 5690834, 5690820, 5690584, 5690163, 5689760, 5688633,
    ],
    Transfer: [
      5691529, 5686739, 5686734, 5678641, 5678577, 5676934, 5675141, 5675016,
      5674926, 5674772, 5674681, 5674658, 5672933, 5672984, 5672933,
    ],
    PriceUpdate: [
      5692394, 5692321, 5692248, 5692166, 5692080, 5691983, 5691965,
    ],
  };

  describe('BMXEventPool', function () {
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
