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
import { configEUR } from './constants';

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

  // EUR
  const eventsToTestEUR: Record<Address, EventMappings> = {
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

  const eventsToTestUSD: Record<Address, EventMappings> = {
    //Transmuter Events
    '0x222222fD79264BBE280b4986F6FEfBC3524d0137': {
      FeesSet: [19539192, 19539193, 19539198, 19539199],
      RedemptionCurveParamsSet: [],
      OracleSet: [19539189, 19539191, 19539197],
      Swap: [
        19609442, 19609442, 19612088, 19612720, 19612970, 19613233, 19613417,
        19613466, 19614093, 19615163, 19615653, 19616187, 19616247, 19616257,
        19616459, 19616597, 19616723, 19616850, 19616966, 19616990, 19617295,
        19617327, 19617327, 19617335, 19617394, 19617406, 19617508, 19617521,
        19617543, 19618077, 19618185, 19618395, 19619660, 19619853, 19620424,
        19620631, 19620917, 19620950, 19621140, 19621187, 19621308, 19622224,
        19622628, 19622951, 19622974, 19623084, 19623835, 19624153, 19624153,
        19624236, 19624376, 19624955, 19625166, 19625524, 19625679, 19627173,
        19627831, 19628073, 19628437, 19629497, 19630262, 19630452, 19630453,
        19630569, 19630846, 19630998, 19631045, 19631072, 19631089, 19631246,
        19631277, 19631526, 19631561, 19631603, 19631653, 19631772, 19631838,
        19632250, 19633153, 19633215, 19633259, 19633531, 19633556, 19633605,
        19634664, 19634767, 19635043, 19635866, 19636522, 19636596, 19637181,
        19637803, 19637913, 19638541, 19639245, 19639420, 19639420, 19639995,
        19640181, 19640895,
      ],
      Redeemed: [],
      ReservesAdjusted: [],
      CollateralAdded: [19539190, 19539196],
      CollateralRevoked: [],
      CollateralWhitelistStatusUpdated: [19539202],
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
        19581667, 19582915, 19585628, 19587407, 19588157, 19588208, 19590069,
        19590733, 19590797, 19592697, 19593362, 19593473, 19594011, 19595306,
        19596519, 19597364, 19599063, 19599206, 19602087, 19602936, 19603096,
        19603429, 19608399, 19608426, 19610964, 19612913, 19617893, 19618624,
        19619754, 19620051, 19621535, 19623267, 19624153, 19624164, 19629126,
        19630421, 19630643, 19630671, 19631025, 19633145, 19637639, 19638537,
        19638655, 19639050, 19639147, 19639164, 19639420, 19641771, 19642216,
        19643013, 19644465, 19646888, 19648977, 19649555, 19649742, 19651107,
        19651169, 19651577, 19652313, 19652647, 19657982, 19660275, 19662862,
        19667407, 19669210, 19669302, 19670406, 19674048, 19676127, 19677576,
        19680251, 19680544, 19681017, 19682815, 19689659, 19689880, 19692533,
        19697311, 19697903, 19698704, 19698867, 19701099, 19701428, 19702068,
        19703302, 19703569, 19704999, 19705931, 19705954, 19706402, 19706567,
        19708213, 19708713, 19708727, 19712712, 19713229, 19714392, 19720091,
        19720560, 19722127,
      ],
      Deposit: [
        19582915, 19587407, 19588157, 19588208, 19590797, 19592697, 19593362,
        19594011, 19599063, 19602087, 19603096, 19610964, 19612913, 19618624,
        19620051, 19624153, 19629126, 19630421, 19630643, 19630671, 19633145,
        19638537, 19638655, 19639050, 19639147, 19639420, 19652647, 19657982,
        19660275, 19670406, 19674048, 19677576, 19689880, 19692533, 19697311,
        19697903, 19698704, 19698867, 19701099, 19701428, 19702068, 19703302,
        19703569, 19705931, 19705954, 19706402, 19706567, 19708213, 19708713,
        19708727, 19713229, 19714392, 19720091, 19720560, 19722127, 19723842,
        19724873, 19724886, 19727258, 19727832, 19727836, 19727900,
      ],
      Withdraw: [
        19581667, 19585628, 19590069, 19590733, 19593473, 19595306, 19596519,
        19597364, 19599206, 19602936, 19603429, 19608399, 19608426, 19617893,
        19619754, 19621535, 19623267, 19624164, 19631025, 19637639, 19639164,
        19641771, 19642216, 19643013, 19644465, 19646888, 19648977, 19649555,
        19649742, 19651107, 19651169, 19651577, 19652313, 19662862, 19667407,
        19669210, 19669302, 19676127, 19680251, 19680544, 19681017, 19682815,
        19689659, 19704999, 19712712, 19723728,
      ],
    },
  };

  beforeEach(async () => {
    angleTransmuterPool = new AngleTransmuterEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      configEUR,
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

  Object.entries(eventsToTestUSD).forEach(
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
