import dotenv from 'dotenv';
dotenv.config();

import { ConcentratorArusdEvent } from './concentrator-arusd-event';
import { ConcentratorArusdConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import ArUSD5115_ABI from '../../abi/concentrator/arUSD5115.json';

import _ from 'lodash';
import { ConcentratorArusdState } from './types';
import { Interface } from 'ethers/lib/utils';
import { JsonFragment } from '@ethersproject/abi';

/*
  README
  ======

  This test script adds unit tests for arUSD event based
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
const dexKey = 'ConcentratorArusd';
const network = Network.MAINNET;

async function fetchPoolState(
  concentratorArusdPool: ConcentratorArusdEvent,
  blockNumber: number,
): Promise<ConcentratorArusdState> {
  return concentratorArusdPool.generateState(blockNumber);
}

describe('concentratorArusd Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    Deposit: [20474218, 20474012, 20472829, 20472449],
    Redeem: [20461979, 20461979, 20461765, 20461765],
  };

  describe('concentratorArusdPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);
          const config = ConcentratorArusdConfig[dexKey][network];

          const concentratorArusdPool = new ConcentratorArusdEvent(
            dexKey,
            dexHelper,
            config.arUSD5115Address,
            new Interface(ArUSD5115_ABI as JsonFragment[]),
            logger,
          );

          await concentratorArusdPool.initialize(blockNumber);

          await testEventSubscriber(
            concentratorArusdPool,
            concentratorArusdPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(concentratorArusdPool, _blockNumber),
            blockNumber,
            `${dexKey}_${concentratorArusdPool}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
