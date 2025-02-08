/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { BasePool } from './pools/base-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolKey, PoolState } from './types';
import { EkuboConfig } from './config';
import { DeepReadonly, DeepWritable } from 'ts-essentials';
import { Contract } from 'ethers';
import CoreABI from '../../abi/ekubo/core.json';
import DataFetcherABI from '../../abi/ekubo/data-fetcher.json';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface } from '@ethersproject/abi';

/*
  README
  ======

  This test script adds unit tests for Ekubo event based
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
  pool: BasePool,
  blockNumber: number,
): Promise<PoolState.Object> {
  return pool.generateState(blockNumber) as Promise<PoolState.Object>;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Ekubo Mainnet', function () {
  const dexKey = 'Ekubo';
  const network = Network.MAINNET;
  const config = EkuboConfig[dexKey][network];
  const dexHelper = new DummyDexHelper(network);
  const core = new Contract(config.core, CoreABI, dexHelper.provider);
  const coreIface = new Interface(CoreABI);
  const dataFetcher = new Contract(
    config.dataFetcher,
    DataFetcherABI,
    dexHelper.provider,
  );
  const logger = dexHelper.getLogger(dexKey);
  let pool: BasePool;

  const eventsToTest: EventMappings = {
    Swapped: [
      21796221, // https://etherscan.io/tx/0x6bb4c90f1ff6f81fc98973590f11968215cd3572c9b285197539d6776bdc4204
    ],
    PositionUpdated: [
      21802238, // https://etherscan.io/tx/0x0c978ec4226b73f7d1e718d93bb91a8e8dd27a7bb173b21b7d17823333e5221a
    ],
  };

  beforeEach(async () => {
    pool = new BasePool(
      dexKey,
      network,
      dexHelper,
      logger,
      core,
      coreIface,
      dataFetcher,
      new PoolKey(
        BigInt(Tokens[network].USDC.address),
        BigInt(Tokens[network].USDT.address),
        8507059173023461994257409214775295n,
        50,
        0n,
      ),
    );
  });

  Object.entries(eventsToTest).forEach(
    ([eventName, blockNumbers]: [string, number[]]) => {
      describe(`${eventName}`, () => {
        blockNumbers.forEach((blockNumber: number) => {
          it(`State after ${blockNumber}`, async function () {
            await testEventSubscriber(
              pool,
              pool.addressesSubscribed,
              (blockNumber: number) => fetchPoolState(pool, blockNumber),
              blockNumber,
              `${dexKey}_${pool.key.stringId()}`,
              dexHelper.provider,
            );
          });
        });
      });
    },
  );
});
