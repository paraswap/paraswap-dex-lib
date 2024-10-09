/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { FluidDexEventPool } from './fluid-dex-pool';
import { FluidDexCommonAddresses } from './fluid-dex-generate-pool';
import { FluidDex } from './fluid-dex';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import {
  commonAddresses,
  FluidDexPool,
  FluidDexPoolState,
  Pool,
} from './types';
import { FluidDexConfig } from './config';
import { DeepReadonly } from 'ts-essentials';

/*
  README
  ======

  This test script adds unit tests for FluidDex event based
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
  fluidDexPool: FluidDexEventPool,
  blockNumber: number,
): Promise<FluidDexPoolState> {
  return await fluidDexPool.generateState(blockNumber);
}

async function fetchTotalPools(
  fluidCommonAddresses: FluidDexCommonAddresses,
  blockNumber: number,
): Promise<DeepReadonly<Pool[]>> {
  return await fluidCommonAddresses.generateState(blockNumber);
}

function stringifyCircular(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    },
    space,
  );
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('FluidDex EventPool Mainnet', function () {
  const dexKey = 'FluidDex';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const fluidDexCommonAddressStruct: commonAddresses =
    FluidDexConfig[dexKey][network].commonAddresses;
  const liquidityProxy: Address = '0x52aa899454998be5b000ad077a46bbe360f4e497';
  const dexFactory: Address = '0x93dd426446b5370f094a1e31f19991aaa6ac0be0';

  const poolFetchEventsToTest: Record<Address, EventMappings> = {
    [dexFactory]: {
      DexDeployed: [20825862],
    },
  };

  // poolAddress -> EventMappings
  const poolUpdateEventsToTest: Record<Address, EventMappings> = {
    [dexFactory]: {
      LogOperate: [20825862],
    },
  };

  let fluidDexEventPool: FluidDexEventPool;
  let fluidDexCommonAddress: FluidDexCommonAddresses;

  Object.entries(poolUpdateEventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  const fluidDex = new FluidDex(network, dexKey, dexHelper);

                  // const latestBlockNumber_ = await dexHelper.web3Provider.eth.getBlockNumber();

                  await fluidDex.initializePricing(blockNumber);

                  // console.log(stringifyCircular(Object.keys(fluidDex.eventPools).length))

                  fluidDexEventPool =
                    fluidDex.eventPools[
                      'FluidDex_0x6d83f60eeac0e50a1250760151e81db2a278e03a'
                    ];

                  console.log(fluidDexEventPool);

                  await testEventSubscriber(
                    fluidDexEventPool,
                    fluidDexEventPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(fluidDexEventPool, _blockNumber),
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

  Object.entries(poolFetchEventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  fluidDexCommonAddress = new FluidDexCommonAddresses(
                    'FluidDex',
                    fluidDexCommonAddressStruct,
                    network,
                    dexHelper,
                    logger,
                  );

                  await testEventSubscriber(
                    fluidDexCommonAddress,
                    fluidDexCommonAddress.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchTotalPools(fluidDexCommonAddress, _blockNumber),
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
