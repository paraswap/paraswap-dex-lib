import dotenv from 'dotenv';
dotenv.config();

import { GMXEventPool } from './pool';
import { GMXConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'GMX';
const network = Network.AVALANCHE;
const params = GMXConfig[dexKey][network];

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

describe('GMX Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdgAmount: [
      41417108, 41417150, 41417213, 41417391, 41417402, 41417403, 41417537,
      41417762, 41417855, 41417896, 41417903, 41417925, 41419874, 41419967,
      41419979, 41420026, 41420222, 41420313, 41426256, 41426437, 41426489,
      41426490, 41426495, 41426550, 41426576, 41426596, 41426684,
    ],
    DecreaseUsdgAmount: [
      41417108, 41417150, 41417168, 41417213, 41417391, 41417402, 41417403,
      41417537, 41417762, 41417855, 41417896, 41417903, 41417925, 41418656,
      41419979, 41420026, 41420342, 41420599, 41426550, 41426576, 41426596,
      41426684, 41427284, 41427329, 41427423, 41427788, 41427814, 41427853,
    ],
    Transfer: [41417168, 41417168, 41418656, 41418656, 41419874],
    PriceUpdate: [
      41417147, 41417147, 41417147, 41417147, 41417147, 41417150, 41417150,
      41417150, 41417150, 41417150, 41417150, 41417164, 41417164, 41417164,
      41417164, 41417164, 41417164,
    ],
  };

  describe('GmxEventPool', function () {
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
