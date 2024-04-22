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

describe('AngleTransmuter EventPool Mainnet', () => {
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
      Swap: [
        19582703, 19583592, 19584048, 19589408, 19602964, 19607526, 19611131,
        19614332, 19616567, 19623965, 19625332, 19631246, 19631653, 19633515,
        19638468, 19648373, 19653214, 19656178, 19657413, 19667310, 19667763,
      ],
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
        19611413, 19618548, 19625698, 19632847, 19633586, 19639991, 19647112,
        19649850, 19649850, 19654237,
      ],
    },
    // Backed Events
    '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3': {
      AnswerUpdated: [
        19574099, 19574442, 19581598, 19588736, 19610148, 19617280, 19624427,
        19638723, 19667243, 19674385,
      ],
    },
    '0x475855DAe09af1e3f2d380d766b9E630926ad3CE': {
      AnswerUpdated: [
        19574095, 19574443, 19581596, 19588737, 19610145, 19617284, 19624426,
        19631578, 19638720, 19667241, 19674386,
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
        EURA: {
          address: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
          decimals: 18,
        },
        transmuter: '0x00253582b2a3FE112feEC532221d9708c64cEFAb',
        collaterals: [
          '0x3f95AA88dDbB7D9D484aa3D482bf0a80009c52c9',
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
            '0x475855DAe09af1e3f2d380d766b9E630926ad3CE': {
              proxy: '0x475855DAe09af1e3f2d380d766b9E630926ad3CE',
              aggregator: '0x475855DAe09af1e3f2d380d766b9E630926ad3CE',
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
              '0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c',
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
                it(`State after ${blockNumber}`, async () => {
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
