import dotenv from 'dotenv';
dotenv.config();

import { MaverickV1EventPool } from './maverick-v1-pool';
import { MaverickV1Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { MMath } from './maverick-math/maverick-basic-math';
import { Tokens } from '../../../tests/constants-e2e';

/*
  README
  ======

  This test script adds unit tests for MaverickV1 event based
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
const dexKey = 'MaverickV1';
const network = Network.MAINNET;
const config = MaverickV1Config[dexKey][network];

async function fetchPoolState(
  maverickV1Pool: MaverickV1EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  return maverickV1Pool.generateState(blockNumber);
}

describe('MaverickV1 Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    AddLiquidity: [16695395, 16714219, 16717028],
    Swap: [16695341, 16721063, 16721263, 16721284, 16721288, 16721323],
    RemoveLiquidity: [16679062, 16714109, 16714176],
    BinMoved: [16682200, 16679494, 16695405, 16682307],
    BinMerged: [16679494, 16700401],
  };

  const addresses: { [contract: string]: string } = {
    poolAddress: '0xfc0c52a2B66A19B39EfbE4332bc42186ADA1eE45',
    poolInspector: MaverickV1Config[dexKey][network].poolInspectorAddress,
  };

  describe('MaverickV1EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const maverickV1Pool = new MaverickV1EventPool(
            dexKey,
            network,
            dexHelper,
            Tokens[network]['USDC'],
            Tokens[network]['USDC'],
            0.01 / 100,
            1,
            0,
            10800e18,
            addresses.poolAddress,
            addresses.poolInspector,
            logger,
          );

          await testEventSubscriber(
            maverickV1Pool,
            maverickV1Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(
                maverickV1Pool,
                _blockNumber,
                maverickV1Pool.address,
              ),
            blockNumber,
            `${dexKey}_${maverickV1Pool.address}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
