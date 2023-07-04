/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { CarbonEventPool } from './carbon-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { CarbonConfig } from './config';
import { DeepReadonly } from 'ts-essentials';

/*
  README
  ======

  This test script adds unit tests for Carbon event based
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

jest.setTimeout(300 * 1000);
const dexKey = 'Carbon';
const network = Network.MAINNET;
const config = CarbonConfig[dexKey][network];

async function fetchPoolState(
  carbonPools: CarbonEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<PoolState>> {
  const message = `Carbon: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);

  const state = carbonPools.generateState(blockNumber);

  console.log(`Done ${message}`);

  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Carbon EventPool Mainnet', function () {
  const dexKey = 'Carbon';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let carbonPool: CarbonEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0xC537e898CD774e2dCBa3B14Ea6f34C93d5eA45e1': {
      StrategyCreated: [
        17423908, 17424211, 17431166, 17434428, 17465333, 17465426, 17432734,
      ],
      StrategyUpdated: [17464816, 17465170, 17465350],
      StrategyDeleted: [
        17415410, 17416581, 17441070, 17448138, 17449924, 17451375,
      ],
    },
  };

  beforeEach(async () => {
    // carbonPool = new CarbonEventPool(dexKey, network, dexHelper, logger);
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  const dexHelper = new DummyDexHelper(network);
                  const logger = dexHelper.getLogger(dexKey);

                  const carbonPools = new CarbonEventPool(
                    dexKey,
                    network,
                    dexHelper,
                    logger,
                  );

                  await testEventSubscriber(
                    carbonPools,
                    carbonPools.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(carbonPools, _blockNumber, poolAddress),
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
