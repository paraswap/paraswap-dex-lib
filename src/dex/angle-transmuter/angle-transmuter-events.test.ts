/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { AngleTransmuterEventPool } from './angle-transmuter-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { DeepReadonly } from 'ts-essentials';

/*
  README
  ======

  This test script adds unit tests for AngleTransmuter event based
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
  angleTransmuterPools: AngleTransmuterEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<PoolState>> {
  return angleTransmuterPools.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('AngleTransmuter EventPool Mainnet', function () {
  const dexKey = 'AngleTransmuter';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let angleTransmuterPool: AngleTransmuterEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    //Transmuter Events
    '0x00253582b2a3FE112feEC532221d9708c64cEFAb': {
      FeesSet: [],
      RedemptionCurveParamsSet: [],
      OracleSet: [],
      Swap: [18012837],
      Redeemed: [],
      ReservesAdjusted: [],
      CollateralAdded: [],
      CollateralRevoked: [],
      CollateralWhitelistStatusUpdated: [],
      WhitelistStatusToggled: [],
    },
    // Pyth Events
    '0x4305FB66699C3B2702D4d05CF36551390A4c69C6': {
      PriceFeedUpdate: [
        17921792, 17922079, 17943228, 17943513, 17960561, 17960561, 17960561,
        17960561, 17960561, 17983718, 17983718, 17984600, 17984600, 17984622,
        17984622, 17984709, 17984709, 17984717, 17984717, 17984778, 17984778,
        17988349, 17988349, 17990018, 17990018, 17990245, 17990245, 18027681,
        18027681, 18027717, 18027717, 18027739, 18027739, 18027751, 18027751,
        18027923, 18027923, 18031029, 18031029, 18081028, 18081028,
      ],
    },
    //Backed Events
    '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3': {
      AnswerUpdated: [
        17926504, 17933436, 17940612, 17962015, 17969174, 17976303, 17983422,
        17990612, 18012042, 18019176, 18026755, 18033471, 18040608, 18062016,
        18069196, 18076364, 18083462, 18090713, 18112016, 18119149,
      ],
    },
    //Redstone Events
    '0x6E27A25999B3C665E44D903B2139F5a4Be2B6C26': {
      AnswerUpdated: [],
    },
  };

  beforeEach(async () => {
    angleTransmuterPool = new AngleTransmuterEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      {
        agEUR: {
          address: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
          decimals: 18,
        },
        transmuter: '0x00253582b2a3FE112feEC532221d9708c64cEFAb',
        collaterals: [
          '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
          '0x2F123cF3F37CE3328CC9B5b8415f9EC5109b45e7',
        ],
        oracles: {
          chainlink: {},
          backed: {
            '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3': {
              proxy: '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3',
              aggregator: '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3',
              decimals: 8,
            },
          },
          redstone: {
            '0x6E27A25999B3C665E44D903B2139F5a4Be2B6C26': {
              proxy: '0x6E27A25999B3C665E44D903B2139F5a4Be2B6C26',
              aggregator: '0x5BeEFeFE23aecccC77d164AB8E9Ff74e056588f1',
              decimals: 8,
            },
          },
          pyth: {
            proxy: '0x4305FB66699C3B2702D4d05CF36551390A4c69C6',
            ids: [
              '0xd052e6f54fe29355d6a3c06592fdefe49fae7840df6d8655bf6d6bfb789b56e4',
              '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
            ],
          },
        },
      },
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
                    angleTransmuterPool,
                    angleTransmuterPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleTransmuterPool,
                        _blockNumber,
                        poolAddress,
                      ),
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
