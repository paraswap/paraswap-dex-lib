import dotenv from 'dotenv';
dotenv.config();

import { DeepReadonly } from 'ts-essentials';
import { WombatEventPool } from './wombat-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import {
  testEventSubscriber,
  getSavedConfig,
  saveConfig,
} from '../../../tests/utils-events';
import { PoolState, WombatConfigInfo } from './types';
import { WombatConfig } from './config';
import { Wombat } from './wombat';
/*
  README
  ======

  This test script adds unit tests for Wombat event based
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

// npx jest src/dex/wombat/wombat-events.test.ts
jest.setTimeout(100 * 1000);

async function fetchPoolState(
  wombatPool: WombatEventPool,
  blockNumber: number,
): Promise<DeepReadonly<PoolState>> {
  return await wombatPool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Wombat EventPool BSC', function () {
  const dexKey = 'Wombat';
  const network = Network.BSC;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let wombatPool: WombatEventPool;
  const mainPoolAddress = WombatConfig.Wombat[Network.BSC].pools[0].address;
  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    // Main pool
    [mainPoolAddress]: {
      Deposit: [22764190],
      // Deposit: [24764190],
    },
  };

  for (const [poolAddress, events] of Object.entries(eventsToTest)) {
    describe(`Events for ${poolAddress}`, () => {
      for (const [eventName, blockNumbers] of Object.entries(events)) {
        describe(`${eventName}`, () => {
          for (const blockNumber of blockNumbers) {
            it(`State after ${blockNumber}`, async function () {
              let cfgInfo = getSavedConfig<WombatConfigInfo>(
                blockNumber,
                dexKey,
              );

              cfgInfo = undefined;
              if (!cfgInfo) {
                const dex = new Wombat(network, dexKey, dexHelper);
                cfgInfo = await dex.generateConfigInfo(blockNumber);
                saveConfig(blockNumber, dexKey, cfgInfo);
              }

              wombatPool = new WombatEventPool(
                dexKey,
                'Main Pool',
                network,
                dexHelper,
                logger,
                poolAddress.toLowerCase(),
                cfgInfo.pools[poolAddress.toLowerCase()],
              );

              await testEventSubscriber(
                wombatPool,
                wombatPool.addressesSubscribed,
                (_blockNumber: number) =>
                  fetchPoolState(wombatPool, _blockNumber),
                blockNumber,
                `${dexKey}_${poolAddress}`,
                dexHelper.provider,
              );
            });
            // });
          }
        });
      }
      // );
    });
  }
  // );
});
