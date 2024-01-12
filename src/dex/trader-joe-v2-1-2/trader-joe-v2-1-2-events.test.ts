/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { TraderJoeV2_1EventPool } from './trader-joe-v2-1-2-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { DeepReadonly } from 'ts-essentials';

/*
  README
  ======

  This test script adds unit tests for TraderJoeV2_1_2 event based
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
  traderJoeV2_1_2Pool: TraderJoeV2_1EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<PoolState>> {
  console.log(`Fetching state for ${poolAddress} at ${blockNumber}`);

  const state = await traderJoeV2_1_2Pool.generateState(blockNumber);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('TraderJoeV2.1 Events Avalanche', function () {
  const dexKey = 'TraderJoeV2_1_2';
  const network = Network.AVALANCHE;
  const poolAddress = '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1';
  const factoryAddress = '0x8e42f2F4101563bF679975178e880FD87d3eFd4e';
  const stateMulticallAddress = '0xBAEeb4540f59d30E567a5B563CC0c4587eDd9366';
  const tokenX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
  const tokenY = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
  const binStep = 20n;
  // const initBlockNumber = 1;
  // const initBlockNumber = 40245632;
  const dexHelper = new DummyDexHelper(network);
  // const logger = dexHelper.getLogger(dexKey);
  // let traderJoeV2_1_2Pool: TraderJoeV2_1EventPool = new TraderJoeV2_1EventPool(
  //   dexKey,
  //   network,
  //   dexHelper,
  //   tokenX,
  //   tokenY,
  //   binStep,
  //   factoryAddress,
  //   stateMulticallAddress,
  //   logger,
  // );
  // // done when adding pool, manually here
  // traderJoeV2_1_2Pool.poolAddress = poolAddress;
  // traderJoeV2_1_2Pool.addressesSubscribed = [poolAddress];
  // await traderJoeV2_1_2Pool.initialize(initBlockNumber, {
  //   initCallback: (state: DeepReadonly<PoolState>) => {
  //     // need to push poolAddress so that we subscribeToLogs in StatefulEventSubscriber
  //     traderJoeV2_1_2Pool!.addressesSubscribed[0] = state.pairAddress;
  //     traderJoeV2_1_2Pool!.poolAddress = state.pairAddress;
  //     traderJoeV2_1_2Pool!.initFailed = false;
  //     traderJoeV2_1_2Pool!.initRetryAttemptCount = 0;
  //   },
  // });

  // beforeEach(async () => {
  //   traderJoeV2_1_2Pool = new TraderJoeV2_1EventPool(
  //     dexKey,
  //     network,
  //     dexHelper,
  //     tokenX,
  //     tokenY,
  //     binStep,
  //     factoryAddress,
  //     stateMulticallAddress,
  //     logger,
  //   );
  //   // done when adding pool, manually here
  //   traderJoeV2_1_2Pool.poolAddress = poolAddress;
  //   traderJoeV2_1_2Pool.addressesSubscribed = [poolAddress];
  //   // await traderJoeV2_1_2Pool.initialize(initBlockNumber, {
  //   //   initCallback: (state: DeepReadonly<PoolState>) => {
  //   //     // need to push poolAddress so that we subscribeToLogs in StatefulEventSubscriber
  //   //     traderJoeV2_1_2Pool!.addressesSubscribed[0] = state.pairAddress;
  //   //     traderJoeV2_1_2Pool!.poolAddress = state.pairAddress;
  //   //     traderJoeV2_1_2Pool!.initFailed = false;
  //   //     traderJoeV2_1_2Pool!.initRetryAttemptCount = 0;
  //   //   },
  //   // });
  // });

  const blockNumbers: { [eventName: string]: number[] } = {
    // ['DepositedToBins']: [
    //   40265174,
    //   // 40258737, 40258967, 40259019, 40259075, 40260226, 40261211, 40261465,
    //   // 40261552, 40261699, 40262152, 40262281, 40262584, 40262678, 40262911,
    //   // 40263088, 40263238, 40263507, 40263563, 40265174,
    // ],
    // ['WithdrawnFromBins']: [
    //   40264029,
    //   // 40256521, 40257151, 40258274, 40260226, 40261192, 40261411, 40261604,
    //   // 40261793, 40262171, 40263718, 40264029, 40264197, 40264248, 40264366,
    //   // 40265426,
    // ],
    ['CompositionFees']: [
      40262584,
      // 40262584, 40262678, 40263088, 40263238, 40263507, 40264029, 40264082,
      // 40264274, 40264443,
    ],
  };

  describe('TraderJoeV2.1 Events', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          const traderJoeV2_1_2Pool = new TraderJoeV2_1EventPool(
            dexKey,
            network,
            dexHelper,
            tokenX,
            tokenY,
            binStep,
            factoryAddress,
            stateMulticallAddress,
            logger,
          );
          // done when adding pool, manually here
          traderJoeV2_1_2Pool.poolAddress = poolAddress;
          traderJoeV2_1_2Pool.addressesSubscribed = [poolAddress];

          await testEventSubscriber(
            traderJoeV2_1_2Pool as any,
            traderJoeV2_1_2Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(traderJoeV2_1_2Pool, _blockNumber, poolAddress),
            blockNumber,
            `${dexKey}_${poolAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });

  // // poolAddress -> EventMappings
  // const eventsToTest: Record<Address, EventMappings> = {
  //   [traderJoeV2_1_2Pool.poolAddress!]: {
  //     ['DepositedToBins']: [
  //       40258737, 40258967, 40259019, 40265174,

  //       // 40258737, 40258967, 40259019, 40259075, 40260226, 40261211, 40261465,
  //       // 40261552, 40261699, 40262152, 40262281, 40262584, 40262678, 40262911,
  //       // 40263088, 40263238, 40263507, 40263563, 40265174,
  //     ],
  //   },
  // };

  // Object.entries(eventsToTest).forEach(
  //   ([poolAddress, events]: [string, EventMappings]) => {
  //     describe(`Events for ${poolAddress}`, () => {
  //       Object.entries(events).forEach(
  //         ([eventName, blockNumbers]: [string, number[]]) => {
  //           describe(`${eventName}`, () => {
  //             blockNumbers.forEach((blockNumber: number) => {
  //               it(`State after ${blockNumber}`, async function () {
  //                 await testEventSubscriber(
  //                   traderJoeV2_1_2Pool,
  //                   traderJoeV2_1_2Pool.addressesSubscribed,
  //                   (_blockNumber: number) =>
  //                     fetchPoolState(
  //                       traderJoeV2_1_2Pool,
  //                       _blockNumber,
  //                       poolAddress,
  //                     ),
  //                   blockNumber,
  //                   `${dexKey}_${poolAddress}`,
  //                   dexHelper.provider,
  //                 );
  //               });
  //             });
  //           });
  //         },
  //       );
  //     });
  //   },
  // );
});
