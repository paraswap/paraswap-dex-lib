/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VerifiedEventPool } from './verified-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, PoolStateMap, SubgraphPoolBase } from './types';
import { VerifiedConfig } from './config';

/*
  README
  ======

  This test script adds unit tests for Verified event based
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
  balancerV1Pool: VerifiedEventPool,
  blockNumber: number,
): Promise<PoolStateMap> {
  return await balancerV1Pool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Verified EventPool Mainnet', function () {
  const parentName = 'Verified'; //DexKey or DexName
  const georliNetwork = Network.GEORLI;
  const georliConfig = VerifiedConfig[parentName][georliNetwork];
  const dexHelper = new DummyDexHelper(georliNetwork);
  const logger = dexHelper.getLogger(parentName);

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x007dc5733ff3fd01e82a430c82a23d4c5bd40715': {
      Swap: [9107266],
    },
    '0x00ce8ab3940f6bd3555bd34412e8464be3ec12fa': {
      Swap: [8906384],
    },
  };
  let verifiedPool: VerifiedEventPool;
  beforeEach(async () => {
    verifiedPool = new VerifiedEventPool(
      parentName,
      georliNetwork,
      dexHelper,
      georliConfig.vaultAddress,
      georliConfig.subGraphUrl,
      logger,
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
                    verifiedPool,
                    verifiedPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(verifiedPool, _blockNumber),
                    blockNumber,
                    `${parentName}_${poolAddress}`,
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
