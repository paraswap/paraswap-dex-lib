/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VirtuSwapEventPool } from './virtuswap-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { DeepReadonly } from 'ts-essentials';
import { VirtuSwapConfig } from './config';

/*
  README
  ======

  This test script adds unit tests for VirtuSwap event based
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
  `npx jest src/dex/virtuswap/virtuswap-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  virtuswapPool: VirtuSwapEventPool,
  blockNumber: number,
): Promise<DeepReadonly<PoolState>> {
  return await virtuswapPool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

type PoolEventsInfo = {
  poolAddress: Address;
  token0Address: Address;
  token1Address: Address;
  eventsMap: EventMappings;
};

//TODO: add tests for vPairFactory events
describe('VirtuSwap EventPool', function () {
  const dexKey = 'VirtuSwap';

  // networkId -> PoolEventsInfo[]
  const eventsToTest: Partial<Record<Network, PoolEventsInfo[]>> = {
    [Network.POLYGON]: [
      // VRSW-WETH
      {
        poolAddress: '0x68BfaE97d4970ba6f542c2a93Ed2e6eDBBf96c3b',
        token0Address: '0x57999936fC9A9EC0751a8D146CcE11901Be8beD0',
        token1Address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        eventsMap: {
          ReserveSync: [55283344, 55373346],
          vSync: [55395552, 55402173, 55430710, 55433860],
        },
      },
      // WMATIC-USDC.e
      {
        poolAddress: '0x61e7Af17bA4F3C41D0d30D15133C02E1Eb6a160b',
        token0Address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        token1Address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        eventsMap: {
          ReserveSync: [55323873],
          vSync: [55419625, 55432335],
        },
      },
      // WMATIC-DECATS
      {
        poolAddress: '0x3EF0458a06b7507112fC67cD2aaa636e93C29d91',
        token0Address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        token1Address: '0x198f1D316aad1C0Bfd36a79bd1A8e9dba92DAa18',
        eventsMap: {
          ReserveSync: [50556813], // Liquidate Reserve
          AllowListChanged: [52799588, 52799593, 52799696], // Set Allow List
        },
      },
      // USDC.e-USDT
      {
        poolAddress: '0x718C2A6A8F60026E13f406aF077B0D84D075d222',
        token0Address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        token1Address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        eventsMap: {
          AllowListChanged: [52799297, 52799705],
          ReserveSync: [55467619, 55468496],
        },
      },
    ],
    [Network.ARBITRUM]: [
      // VRSW-USDC.e
      {
        poolAddress: '0xD7d90067A07620EdEc49665B5703E539811aeb17',
        token0Address: '0xd1E094CabC5aCB9D3b0599C3F76f2D01fF8d3563',
        token1Address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        eventsMap: {
          ReserveSync: [196701768, 196876948],
          vSync: [197478498],
        },
      },
    ],
  };

  Object.entries(eventsToTest).forEach(([networkId, eventsInfos]) => {
    describe(`Network id: ${networkId}`, () => {
      const network = parseInt(networkId) as Network;
      const params = VirtuSwapConfig[dexKey][network];
      const dexHelper = new DummyDexHelper(network);
      const logger = dexHelper.getLogger(dexKey);
      eventsInfos.forEach(eventsInfo => {
        describe(`Events for ${eventsInfo.poolAddress}`, () => {
          const virtuswapPool = new VirtuSwapEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            params.isTimestampBased,
            eventsInfo.token0Address,
            eventsInfo.token1Address,
            eventsInfo.poolAddress,
          );
          Object.entries(eventsInfo.eventsMap).forEach(
            ([eventName, blockNumbers]: [string, number[]]) => {
              describe(`${eventName}`, () => {
                blockNumbers.forEach((blockNumber: number) => {
                  it(`State after ${blockNumber}`, async function () {
                    await testEventSubscriber(
                      virtuswapPool,
                      virtuswapPool.addressesSubscribed,
                      (_blockNumber: number) =>
                        fetchPoolState(virtuswapPool, _blockNumber),
                      blockNumber,
                      `${dexKey}_${networkId}_${eventsInfo.poolAddress}`,
                      dexHelper.provider,
                    );
                  });
                });
              });
            },
          );
        });
      });
    });
  });
});
