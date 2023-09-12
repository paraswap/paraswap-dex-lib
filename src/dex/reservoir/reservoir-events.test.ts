/* eslint-disable no-console */
import dotenv from 'dotenv';
import { ReservoirEventPool } from './reservoir-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { ReservoirPoolState, ReservoirPoolTypes } from './types';

dotenv.config();

/*
  README
  ======

  This test script adds unit tests for Reservoir event based
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
  reservoirFinancePools: ReservoirEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<ReservoirPoolState> {
  const message = `Reservoir: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);

  const state = reservoirFinancePools.generateState(blockNumber);
  console.log(`fetchPoolState done ${message}`);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Reservoir EventPool AVAX Mainnet', function () {
  const dexKey = 'Reservoir';
  const network = Network.AVALANCHE;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let reservoirFinancePool: ReservoirEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x146D00567Cef404c1c0aAF1dfD2abEa9F260B8C7': {
      // these blocks are one before the event happening
      // if I add 1 to those block numbers the test fails
      Sync: [33021202, 33051183, 33754995],
    },
  };

  beforeEach(async () => {
    reservoirFinancePool = new ReservoirEventPool(
      dexKey,
      dexHelper,
      '0x146D00567Cef404c1c0aAF1dfD2abEa9F260B8C7',
      {
        address: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
        decimals: 6,
      },
      {
        address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        decimals: 6,
      },
      ReservoirPoolTypes.Stable,
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
                    reservoirFinancePool,
                    reservoirFinancePool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        reservoirFinancePool,
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
