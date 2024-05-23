import dotenv from 'dotenv';
dotenv.config();

import { SparkSDaiEventPool } from './spark-sdai-pool';
import { SDaiConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { SparkSDaiPoolState } from './types';

import PotAbi from '../../abi/maker-psm/pot.json';
import { Interface } from '@ethersproject/abi';
import _ from 'lodash';

/*
  README
  ======

  This test script adds unit tests for SDai event based
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
const dexKey = 'Spark';
const network = Network.MAINNET;

async function fetchPoolState(
  sdaiPool: SparkSDaiEventPool,
  blockNumber: number,
): Promise<SparkSDaiPoolState> {
  return sdaiPool.generateState(blockNumber);
}

describe('SDai Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    drip: [19827559, 19827524, 19827163, 19827124, 19827000, 19826892],
    // TODO: no matching logs, you have to manually call "file"
    // from "0xbe8e3e3618f7474f8cb1d074a26affef007e98fb" address
    // https://etherscan.io/advanced-filter?fadd=0x197e90f9fad81970ba7976f33cbd77088e5d7cf7&tadd=0x197e90f9fad81970ba7976f33cbd77088e5d7cf7&mtd=0x29ae8114%7eFile
    // file: [19831086]
  };

  const addresses: { [contract: string]: string } = {
    potAddress: SDaiConfig[dexKey][network].potAddress,
  };

  describe('SDaiPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const sdaiPool = new SparkSDaiEventPool(
            dexKey,
            `dai-sdai-pool`,
            dexHelper,
            addresses.potAddress,
            new Interface(PotAbi),
            logger,
          );

          await sdaiPool.initialize(blockNumber);

          await testEventSubscriber(
            sdaiPool,
            sdaiPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(sdaiPool, _blockNumber),
            blockNumber,
            `${dexKey}_${sdaiPool}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
