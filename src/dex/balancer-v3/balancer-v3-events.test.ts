/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { BalancerV3EventPool } from './balancer-v3-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolStateMap } from './types';
import { BalancerV3Config } from './config';
import _ from 'lodash';

/*
  README
  ======

  This test script adds unit tests for BalancerV3 event based
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
  `npx jest src/dex/balancer-v3/balancer-v3-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  balancerV3Pools: BalancerV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolStateMap> {
  const pools = await balancerV3Pools.generateState(blockNumber);
  // Filter to pool of interest
  return Object.entries(_.cloneDeep(pools) as PoolStateMap)
    .filter(([address]) => {
      return address === poolAddress;
    })
    .reduce((acc, [address, pool]) => {
      acc[address] = pool;
      return acc;
    }, {} as PoolStateMap);
}

// eventName -> blockNumbers
type EventMappings = Record<string, EventData>;
type EventData = { blockNumbers: number[]; poolAddress: string[] };

describe('BalancerV3 EventPool', function () {
  const dexKey = 'BalancerV3';
  const network = Network.SEPOLIA;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let balancerV3Pool: BalancerV3EventPool;

  // vault -> EventMappings
  // TODO once we have a new test deployment add tests for: AggregateSwapFeePercentageChanged, SwapFeePercentageChanged, PoolPausedStateChanged
  const eventsToTest: Record<Address, EventMappings> = {
    [BalancerV3Config.BalancerV3[network].vaultAddress]: {
      // - https://eth-sepolia.blockscout.com/tx/0x6c2a7a38fd469779269f11ff8366ef01de0977219972cbe2eaa3c9a0a9a91d1e
      PoolBalanceChanged: {
        blockNumbers: [6839703],
        poolAddress: ['0xd71958aed5e2e835a648ff832a181f7bdabbaf13'],
      },
    },
  };

  beforeEach(async () => {
    balancerV3Pool = new BalancerV3EventPool(
      dexKey,
      network,
      dexHelper,
      logger,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([vaultAddress, events]: [string, EventMappings]) => {
      describe(`Events for Vault: ${vaultAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, eventData]: [string, EventData]) => {
            describe(`${eventName}`, () => {
              eventData.blockNumbers.forEach((blockNumber: number, i) => {
                it(`Pool: ${eventData.poolAddress[i]} State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    balancerV3Pool,
                    balancerV3Pool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        balancerV3Pool,
                        _blockNumber,
                        eventData.poolAddress[i],
                      ),
                    blockNumber,
                    `${dexKey}_${vaultAddress}`,
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
