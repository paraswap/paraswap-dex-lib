/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { AngleStakedStableEventPool } from './angle-staked-stable-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { AngleStakedStableConfig } from './config';

/*
  README
  ======

  This test script adds unit tests for AngleStakedStable event based
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

async function fetchPoolState(
  angleStakedStablePools: AngleStakedStableEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  return angleStakedStablePools.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('AngleStakedStable EventPool Mainnet', function () {
  const dexKey = 'AngleStakedStable';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let angleStakedStablePool: AngleStakedStableEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x004626a008b1acdc4c74ab51644093b155e59a23': {
      Accrued: [],
      Deposit: [18134921, 18135441],
      Withdraw: [18135030],
      ToggledPause: [],
      RateUpdated: [18176668],
    },
  };

  beforeEach(async () => {
    angleStakedStablePool = new AngleStakedStableEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      AngleStakedStableConfig[dexKey][network],
    );
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    angleStakedStablePool,
                    angleStakedStablePool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleStakedStablePool,
                        _blockNumber,
                        poolAddress,
                      ),
                    blockNumber,
                    `${dexKey}_${poolAddress}`,
                    dexHelper.provider,
                  );
                });
              });
            });
          },
        );
      });
    },
  );
});
