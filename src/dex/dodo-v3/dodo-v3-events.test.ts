/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DodoV3EventPool } from './dodo-v3-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { D3VaultState, PoolState } from './types';
import { DodoV3Vault } from './dodo-v3-vault';
import { DeepReadonly } from 'ts-essentials';
import { DodoV3Config } from './config';

/*
  README
  ======

  This test script adds unit tests for DodoV3 event based
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
  dodoV3Pools: DodoV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  // TODO: complete me!
  return {};
}

async function fetchVaultState(
  dodoV3Vault: DodoV3Vault,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<D3VaultState>> {
  const message = `DodoV3: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  const state = dodoV3Vault.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('DodoV3 EventPool Mainnet', function () {
  const dexKey = 'DodoV3';
  const network = Network.ARBITRUM;
  const dexHelper = new DummyDexHelper(network);
  const config = DodoV3Config[dexKey][network];
  const logger = dexHelper.getLogger(dexKey);
  let dodoV3Pool: DodoV3EventPool;
  let dodoV3Vault: DodoV3Vault;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    [config.D3Vault]: {
      AddToken: [140962617],
    },
  };

  beforeEach(async () => {
    // dodoV3Pool = new DodoV3EventPool(
    //   dexKey,
    //   network,
    //   dexHelper,
    //   logger,
    //   /* TODO: Put here additional constructor arguments if needed */
    // );

    dodoV3Vault = new DodoV3Vault(
      dexHelper,
      dexKey,
      config.D3Vault,
      logger,
      async () => {},
      async () => {},
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
                  // await testEventSubscriber(
                  //   dodoV3Pool,
                  //   dodoV3Pool.addressesSubscribed,
                  //   (_blockNumber: number) =>
                  //     fetchPoolState(dodoV3Pool, _blockNumber, poolAddress),
                  //   blockNumber,
                  //   `${dexKey}_${poolAddress}`,
                  //   dexHelper.provider,
                  // );

                  await testEventSubscriber(
                    dodoV3Vault,
                    dodoV3Vault.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchVaultState(dodoV3Vault, _blockNumber, poolAddress),
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
