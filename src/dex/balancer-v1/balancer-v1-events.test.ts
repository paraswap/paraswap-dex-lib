import dotenv from 'dotenv';
dotenv.config();

import { BalancerV1EventPool } from './balancer-v1-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, PoolsInfo } from './types';
import { BalancerV1Config } from './config';
import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';

const balancerPools = require('./balancer-pools.json') as PoolsInfo;

/*
  README
  ======

  This test script adds unit tests for BalancerV1 event based
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
  balancerV1Pool: BalancerV1EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  // TODO: complete me!
  return await balancerV1Pool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('BalancerV1 EventPool Mainnet', function () {
  const dexKey = 'BalancerV1';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const balancerMulticall = new dexHelper.web3Provider.eth.Contract(
    BalancerCustomMulticallABI as any,
    BalancerV1Config[dexKey][network].multicallAddress,
  );

  // poolAddress -> EventMappings
  // poolAddress must be lowercased to match what's in the json file
  const eventsToTest: Record<Address, EventMappings> = {
    '0x49ff149d649769033d43783e7456f626862cd160': {
      LOG_JOIN: [15408118],
      LOG_EXIT: [15408123, 15408138, 15408247, 15408291, 15408327, 15408349],
      LOG_SWAP: [
        15407544, 15407571, 15407822, 15407828, 15407852, 15407999, 15408136,
        15408715, 15408896, 15408959, 15409162, 15409179, 15409261,
      ],
    },
  };

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  const balancerV1Pool = new BalancerV1EventPool(
                    dexKey,
                    network,
                    dexHelper,
                    logger,
                    balancerMulticall,
                    balancerPools.pools.find(p => p.id === poolAddress)!,
                    /* TODO: Put here additional constructor arguments if needed */
                  );
                  await testEventSubscriber(
                    balancerV1Pool,
                    balancerV1Pool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(balancerV1Pool, _blockNumber, poolAddress),
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
