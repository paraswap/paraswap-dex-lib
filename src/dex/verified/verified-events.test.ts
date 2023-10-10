/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VerifiedEventPool } from './verified-pool';
import { Network, SwapSide } from '../../constants';
import { Address, Token } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, PoolStateMap, SubgraphPoolBase } from './types';
import { VerifiedConfig } from './config';
import { assert } from 'console';

/*
  README
  ======

  This test script adds unit tests for Verified event based
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
  verifiedPool: VerifiedEventPool,
  blockNumber: number,
): Promise<PoolStateMap> {
  return await verifiedPool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Verified EventPool', function () {
  const parentName = 'Verified'; //DexKey or DexName
  const network = Network.POLYGON;
  const networkConfig = VerifiedConfig[parentName][network];
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(parentName);

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x1871c8321b099c3c0e8a69340a8bf93f3d4b1c9a': {
      Swap: [48391093],
    },
    '0x1b96d5660be3e948ddf331aa05e46c59c6a832f4': {
      Swap: [48391093],
    },
  };
  let verifiedPool: VerifiedEventPool;
  beforeEach(async () => {
    verifiedPool = new VerifiedEventPool(
      parentName,
      network,
      dexHelper,
      networkConfig.vaultAddress,
      networkConfig.subGraphUrl,
      logger,
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
                  await testEventSubscriber(
                    verifiedPool,
                    verifiedPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(verifiedPool, _blockNumber),
                    blockNumber,
                    `${parentName}_${poolAddress}`,
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

  describe('Custom Test', () => {
    it('All pools test: ', async () => {
      const poolsMap = await fetchPoolState(verifiedPool, 48391093);
      expect(verifiedPool.allPools.length).toBeGreaterThan(0);
      const creator: string = '';
      //other tests
      Object.entries(poolsMap).forEach(([poolAddress, poolState]) => {
        const subgraphPool = verifiedPool.allPools.find(
          pool => pool.address.toLowerCase() === poolAddress.toLowerCase(),
        );
        //test for maintokens: (must not include bpt token/poolAddress)
        subgraphPool?.mainTokens.forEach(token => {
          expect(token.address !== poolAddress);
        });
        let tokens: Token[] = [];
        subgraphPool?.mainTokens.forEach(token => {
          const _token = subgraphPool.tokens.find(
            t => t.address === token.address,
          );
          tokens.push({
            address: _token?.address!,
            decimals: _token?.decimals!,
          });
        });
        const price1 = verifiedPool.getPricesPool(
          tokens[0],
          tokens[1],
          subgraphPool!,
          poolState,
          [0n, 745000000000000000n],
          745000000000000000n,
          SwapSide.SELL,
          creator,
        );
        // const price2 = verifiedPool.getPricesPool(tokens[0], tokens[1], subgraphPool!, poolState, [BigInt(10), BigInt(5)], BigInt(6), SwapSide.BUY)
        const price3 = verifiedPool.getPricesPool(
          tokens[1],
          tokens[0],
          subgraphPool!,
          poolState,
          [0n, 2126543n],
          2126543n,
          SwapSide.SELL,
          creator,
        );
        // const price4 = verifiedPool.getPricesPool(tokens[1], tokens[0], subgraphPool!, poolState, [BigInt(10), BigInt(5)], BigInt(6), SwapSide.BUY)
        console.log(
          subgraphPool?.poolType,
          ' Sell Price: for ',
          tokens[0],
          ' : ',
          price1,
        );
        // console.log(subgraphPool?.poolType,  " Buy Price: for ",  tokens[0], " : ", price2);
        console.log(
          subgraphPool?.poolType,
          ' Sell Price: for ',
          tokens[1],
          ' : ',
          price3,
        );
        // console.log(subgraphPool?.poolType,  " Buy Price: for ",  tokens[1], " : ", price4);
      });
    });
  });
});
