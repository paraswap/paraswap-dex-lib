import dotenv from 'dotenv';
dotenv.config();

import { MetavaultTradeEventPool } from './pool';
import { MetavaultTradeConfig } from './config';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

/*
  README
  ======

  This test script adds unit tests for MetavaultTrade event based
  system. This is done by fetching the state on-chain before the
  event block, manually pushing the block logs to the event-subscriber,
  comparing the local state with on-chain state.

  Most of the logic for testing is abstracted by `testEventSubscriber`.
  You need to do two things to make the tests work:

  1. Fetch the block numbers where certain events were released. You
  can modify the `./scripts/fetch-event-blocknumber.ts` to get the
  block numbers for different events. Make sure to get sufficient
  number of blockNumbers to cover all possible cases for the event
  mutations.

  2. Complete the implementation for fetchPoolState function. The
  function should fetch the on-chain state of the event subscriber
  using just the blocknumber.

  The template tests only include the test for a single event
  subscriber. There can be cases where multiple event subscribers
  exist for a single DEX. In such cases additional tests should be
  added.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);
const dexKey = 'MetavaultTrade';
const network = Network.POLYGON;
const params = MetavaultTradeConfig[dexKey][network];

async function fetchPoolState(
  metavaultTradePools: MetavaultTradeEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return metavaultTradePools.generateState(blockNumber);
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

describe('MetavaultTrade Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdmAmount: [
      19403150, 19403175, 19403183, 19403215, 19403232, 19403246, 19403344,
      19403484, 19403545, 19403553, 19403586, 19403662, 19403712, 19403721,
      19403757, 19403775, 19403782, 19403800, 19403807, 19403808, 19403826,
      19403844, 19403848, 19403852, 19403860, 19403863, 19403875, 19403877,
      19403885, 19403900, 19403904, 19403938, 19403963, 19403970, 19403973,
      19403978, 19403999, 19404000, 19404023, 19404026, 19404046, 19404056,
      19404060, 19404078, 19404083, 19404097, 19404149, 19404164, 19404178,
      19404182, 19404229, 19404243, 19404264, 19404272, 19404287, 19404347,
      19404378, 19404379, 19404389, 19404408, 19404463, 19404491, 19404560,
      19404625, 19404657, 19404687, 19404700, 19404714, 19404763, 19404889,
      19404892, 19404893, 19404894, 19404897, 19404904, 19404916, 19404917,
      19404927, 19404935, 19404946, 19404949, 19404951, 19404959, 19404973,
      19405017, 19405027, 19405034,
    ],
    DecreaseUsdmAmount: [
      19403150, 19403175, 19403183, 19403215, 19403232, 19403246, 19403344,
      19403545, 19403553, 19403662, 19403712, 19403721, 19403757, 19403775,
      19403782, 19403800, 19403807, 19403808, 19403826, 19403844, 19403848,
      19403852, 19403860, 19403863, 19403875, 19403877, 19403885, 19403900,
      19403904, 19403938, 19403963, 19403970, 19403973, 19403978, 19403999,
      19404000, 19404023, 19404026, 19404046, 19404056, 19404060, 19404078,
      19404083, 19404097, 19404149, 19404164, 19404178, 19404182, 19404229,
      19404243, 19404264, 19404272, 19404287, 19404347, 19404378, 19404379,
      19404389, 19404408, 19404463, 19404491, 19404560, 19404625, 19404657,
      19404687, 19404700, 19404714, 19404763, 19404889, 19404892, 19404893,
      19404894, 19404897, 19404904, 19404916, 19404917, 19404927, 19404935,
      19404946, 19404949, 19404951, 19404959, 19404973, 19405017, 19405027,
      19405034,
    ],
    Transfer: [19403484, 19403586, 19405046, 19405100, 19405154, 19405318],
    PriceUpdate: [
      19403134, 19403135, 19403140, 19403141, 19403144, 19403148, 19403151,
      19403154, 19403163, 19403169, 19403170, 19403171, 19403178, 19403185,
      19403186, 19403202,
    ],
  };

  describe('MetavaultTradeEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await MetavaultTradeEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );
          const metavaultTradePool = new MetavaultTradeEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

          await testEventSubscriber(
            metavaultTradePool,
            metavaultTradePool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(metavaultTradePool, _blockNumber),
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
