/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { TraderJoeV2_1EventPool } from './trader-joe-v2_1-pool';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { DeepReadonly } from 'ts-essentials';
import { TraderJoeV2_1Config } from './config';

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

describe('TraderJoeV2.1 Events Avalanche', function () {
  const dexKey = 'TraderJoeV2_1';
  const network = Network.AVALANCHE;
  const config = TraderJoeV2_1Config[dexKey][network];
  const factoryAddress = config.factory;
  const stateMulticallAddress = config.stateMulticall;

  const poolAddress = '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1';
  const tokenX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
  const tokenY = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
  const binStep = 20n;

  const blockNumbers: { [eventName: string]: number[] } = {
    ['DepositedToBins']: [
      // 40265174,
      40258737, 40258967, 40259019, 40259075, 40260226, 40261211, 40261465,
      40261552, 40261699, 40262152, 40262281, 40262584, 40262678, 40262911,
      40263088, 40263238, 40263507, 40263563, 40265174,
    ],
    ['WithdrawnFromBins']: [
      // 40264029,
      40256521, 40257151, 40258274, 40260226, 40261192, 40261411, 40261604,
      40261793, 40262171, 40263718, 40264029, 40264197, 40264248, 40264366,
      40265426,
    ],
    ['CompositionFees']: [
      // 40262584,
      40262584, 40262678, 40263088, 40263238, 40263507, 40264029, 40264082,
      40264274, 40264443,
    ],
    ['Swap']: [
      // 40246980,
      40246327, 40246422, 40246348, 40246458, 40246767, 40246773, 40246778,
      40246785, 40246926, 40246937, 40246975, 40246980, 40246984, 40246994,
      40247012,
    ],
    // there are only 2 events in the same block
    ['StaticFeeParametersSet']: [29154475],
    ['FlashLoan']: [
      // 40146073,
      40146073, 40177710, 40187861, 40187921, 40254154,
    ],
    ['ForcedDecay']: [],
  };

  describe('TraderJoeV2.1 Events', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);

          const logger = dexHelper.getLogger(dexKey);

          const traderJoeV2_1_2Pool = new TraderJoeV2_1EventPool(
            dexKey,
            network,
            dexHelper,
            tokenX.toLowerCase(),
            tokenY.toLowerCase(),
            binStep,
            factoryAddress.toLowerCase(),
            stateMulticallAddress,
            logger,
          );
          // done when adding pool, manually here
          traderJoeV2_1_2Pool.poolAddress = poolAddress.toLowerCase();
          traderJoeV2_1_2Pool.addressesSubscribed = [poolAddress.toLowerCase()];
          // await traderJoeV2_1_2Pool.initialize(blockNumber - 1, {
          //   initCallback: (state: DeepReadonly<PoolState>) => {
          //     // need to push poolAddress so that we subscribeToLogs in StatefulEventSubscriber
          //     traderJoeV2_1_2Pool.addressesSubscribed[0] = state.pairAddress;
          //     traderJoeV2_1_2Pool.poolAddress = state.pairAddress;
          //     traderJoeV2_1_2Pool.initFailed = false;
          //     traderJoeV2_1_2Pool.initRetryAttemptCount = 0;
          //   },
          // });

          // waitFor(10_000);

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
});

function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
