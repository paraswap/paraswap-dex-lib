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
      41417108, 41417150, 41417213, 41417391, 41417402, 41417403, 41417537,
      41417762, 41417855, 41417896, 41417903, 41417925, 41419874, 41419967,
      41419979, 41420026, 41420222, 41420313, 41426256, 41426437, 41426489,
      41426490, 41426495, 41426550, 41426576, 41426596, 41426684,
    ],
    DecreaseUsdmAmount: [
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
