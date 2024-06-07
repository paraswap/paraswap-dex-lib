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
import {
  configEUR,
  configUSD,
  configUSDArbitrum,
  configUSDBase,
} from './constants';

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
  let angleTransmuterPoolEUR: AngleTransmuterEventPool;
  let angleTransmuterPoolUSD: AngleTransmuterEventPool;

  // poolAddress -> EventMappings

  // EUR
  const eventsToTestEUR: Record<Address, EventMappings> = {
    //Transmuter Events
    '0x00253582b2a3FE112feEC532221d9708c64cEFAb': {
      FeesSet: [],
      RedemptionCurveParamsSet: [],
      OracleSet: [],
      Swap: [
        19582703, 19584048, 19589408, 19602964, 19607526, 19614332, 19623965,
        19625332, 19631246, 19631653, 19633515, 19638468, 19667763,
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

  const eventsToTestUSD: Record<Address, EventMappings> = {
    //Transmuter Events
    '0x222222fD79264BBE280b4986F6FEfBC3524d0137': {
      FeesSet: [19539198, 19539199],
      RedemptionCurveParamsSet: [],
      OracleSet: [],
      Swap: [
        19628073, 19628437, 19629497, 19630262, 19630452, 19630569, 19630846,
        19630998, 19631045, 19631072, 19631526, 19631561, 19631603, 19631653,
        19632250, 19633153, 19633531, 19633556, 19633605, 19634664, 19635866,
        19636522, 19636596, 19637181, 19637803, 19637913, 19638541, 19640895,
      ],
      Redeemed: [],
      ReservesAdjusted: [],
      CollateralAdded: [],
      CollateralRevoked: [],
      CollateralWhitelistStatusUpdated: [],
      WhitelistStatusToggled: [],
    },
    // Chainlink
    '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6': {
      AnswerUpdated: [
        19573923, 19581071, 19588215, 19595354, 19602491, 19609623, 19616758,
        19623902, 19631050, 19638196, 19645326, 19652441, 19659587, 19666715,
        19673861, 19681014, 19688159, 19695297, 19702450, 19709605, 19716765,
      ],
    },
    '0x32d1463EB53b73C095625719Afa544D5426354cB': {
      AnswerUpdated: [
        19574020, 19581171, 19588315, 19595453, 19602589, 19609722, 19616859,
        19623999, 19631149, 19638297, 19645426, 19652545, 19652547, 19659686,
        19666816, 19673959, 19681115, 19688255, 19695398, 19702554, 19709707,
        19716863,
      ],
    },
    // Morpho
    '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB': {
      UpdateLastTotalAssets: [
        19680251, 19680544, 19681017, 19682815, 19689659, 19689880, 19692533,
        19697311, 19697903, 19698704, 19698867, 19701099, 19701428, 19702068,
        19703302, 19703569, 19704999, 19705931, 19705954, 19706402, 19706567,
        19708213, 19708713, 19708727, 19712712, 19713229, 19714392, 19720091,
        19720560, 19722127,
      ],
      Deposit: [
        19697903, 19698704, 19698867, 19701099, 19701428, 19702068, 19703302,
        19703569, 19705931, 19705954, 19706402, 19706567, 19708213, 19708713,
        19708727, 19713229, 19714392, 19720091, 19720560, 19722127, 19723842,
        19724873, 19724886, 19727258, 19727832, 19727836, 19727900,
      ],
      Withdraw: [
        19641771, 19642216, 19643013, 19644465, 19646888, 19648977, 19649555,
        19649742, 19651107, 19651169, 19651577, 19652313, 19662862, 19667407,
        19669210, 19669302, 19676127, 19680251, 19680544, 19681017, 19682815,
        19689659, 19704999, 19712712, 19723728,
      ],
    },
  };

  beforeEach(async () => {
    angleTransmuterPoolEUR = new AngleTransmuterEventPool(
      `${dexKey}_EUR`,
      network,
      dexHelper,
      logger,
      configEUR,
    );
    angleTransmuterPoolUSD = new AngleTransmuterEventPool(
      `${dexKey}_USD`,
      network,
      dexHelper,
      logger,
      configUSD,
    );
  });

  Object.entries(eventsToTestEUR).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async () => {
                  await testEventSubscriber(
                    angleTransmuterPoolEUR,
                    angleTransmuterPoolEUR.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleTransmuterPoolEUR,
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

  Object.entries(eventsToTestUSD).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async () => {
                  await testEventSubscriber(
                    angleTransmuterPoolUSD,
                    angleTransmuterPoolUSD.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleTransmuterPoolUSD,
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

describe('AngleTransmuter EventPool - Arbitrum', () => {
  const dexKey = 'AngleTransmuter';
  const network = Network.ARBITRUM;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let angleTransmuterPoolUSD: AngleTransmuterEventPool;

  // poolAddress -> EventMappings

  const eventsToTestUSD: Record<Address, EventMappings> = {
    //Transmuter Events
    '0xD253b62108d1831aEd298Fc2434A5A8e4E418053': {
      FeesSet: [],
      RedemptionCurveParamsSet: [],
      OracleSet: [],
      Swap: [216524984, 216616166],
      Redeemed: [],
      ReservesAdjusted: [],
      CollateralAdded: [],
      CollateralRevoked: [],
      CollateralWhitelistStatusUpdated: [],
      WhitelistStatusToggled: [],
      StablecoinCapSet: [],
    },
    // Chainlink
    '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3': {
      AnswerUpdated: [
        216725917, 217070222, 217415479, 217760769, 218104896, 218449091,
      ],
    },
  };

  beforeEach(async () => {
    angleTransmuterPoolUSD = new AngleTransmuterEventPool(
      `${dexKey}_USD`,
      network,
      dexHelper,
      logger,
      configUSDArbitrum,
    );
  });

  Object.entries(eventsToTestUSD).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async () => {
                  await testEventSubscriber(
                    angleTransmuterPoolUSD,
                    angleTransmuterPoolUSD.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleTransmuterPoolUSD,
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

describe('AngleTransmuter EventPool - Base', () => {
  const dexKey = 'AngleTransmuter';
  const network = Network.BASE;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let angleTransmuterPoolUSD: AngleTransmuterEventPool;

  // poolAddress -> EventMappings

  const eventsToTestUSD: Record<Address, EventMappings> = {
    //Transmuter Events
    '0x222222880e079445Df703c0604706E71a538Fd4f': {
      FeesSet: [],
      RedemptionCurveParamsSet: [],
      OracleSet: [],
      Swap: [],
      Redeemed: [],
      ReservesAdjusted: [],
      CollateralAdded: [],
      CollateralRevoked: [],
      CollateralWhitelistStatusUpdated: [],
      WhitelistStatusToggled: [],
      StablecoinCapSet: [],
    },
    // Chainlink
    '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B': {
      AnswerUpdated: [15401397],
    },
  };

  beforeEach(async () => {
    angleTransmuterPoolUSD = new AngleTransmuterEventPool(
      `${dexKey}_USD`,
      network,
      dexHelper,
      logger,
      configUSDBase,
    );
  });

  Object.entries(eventsToTestUSD).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async () => {
                  await testEventSubscriber(
                    angleTransmuterPoolUSD,
                    angleTransmuterPoolUSD.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleTransmuterPoolUSD,
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
