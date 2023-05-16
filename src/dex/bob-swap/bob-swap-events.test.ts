/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { BobSwapEventPool } from './bob-swap-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { BobSwapConfig } from './config';
import { erc20Iface } from '../../lib/tokens/utils';

/*
  README
  ======

  This test script adds unit tests for BobSwap event based
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
  bobSwapPools: BobSwapEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `BobVault: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  const state = bobSwapPools.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('BobSwap EventPool Polygon', function () {
  const dexKey = 'BobSwap';
  const network = Network.POLYGON;

  const blockNumbers: { [eventName: string]: number[] } = {
    // 0x72ef4b402b9a2c78796038c5ccfe4a0a6dda91238fdcdbf1dc7263b07ab5512c
    AddCollateral: [36750276, 37176588],
    // 0xbacc19961151cbf3edcf4cf8653aa6017430dbe14fdc333f4e2a78229c47448a
    UpdateFees: [36750276, 37176588, 37953381],
    // 0x8d94e2e2db9f446124d343c4e5a8e3d4612b16bc4f8db4c047c0b8b7d57822c5
    UpdateMaxBalance: [],
    // 0x89f5adc174562e07c9c9b1cae7109bbecb21cf9d1b2847e550042b8653c54a0e
    Buy: [37858143, 37955491, 38047726, 40300563],
    // 0xa082022e93cfcd9f1da5f9236718053910f7e840da080c789c7845698dc032ff
    Sell: [37447862, 40651108, 40651179],
    // 0xcd3829a3813dc3cdd188fd3d01dcf3268c16be2fdd2dd21d0665418816e46062
    Swap: [37417853, 37179124, 37179082],
    // 0xa287a305d884484886886da5686f3b9d8d30c3f3ebedd3b5fa6103ae30bcc011
    Give: [],
  };

  Object.keys(blockNumbers).forEach((event: string) => {
    blockNumbers[event].forEach((blockNumber: number) => {
      it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
        const dexHelper = new DummyDexHelper(network);
        const logger = dexHelper.getLogger(dexKey);
        const config = BobSwapConfig[dexKey][network];

        const bobSwapPool = new BobSwapEventPool(
          dexKey,
          network,
          dexHelper,
          logger,
          config.bobSwapAddress,
          config.bobTokenAddress,
          config.tokens,
          erc20Iface,
        );

        await testEventSubscriber(
          bobSwapPool,
          bobSwapPool.addressesSubscribed,
          (_blockNumber: number) =>
            fetchPoolState(bobSwapPool, _blockNumber, config.bobSwapAddress),
          blockNumber,
          `${dexKey}_${config.bobSwapAddress}`,
          dexHelper.provider,
          logger,
        );
      });
    });
  });
});
