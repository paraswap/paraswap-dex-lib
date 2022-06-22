import dotenv from 'dotenv';
dotenv.config();

import { Platypus } from './platypus';
import { PlatypusPool } from './pool';
import { PlatypusConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import {
  testEventSubscriber,
  getSavedConfig,
  saveConfig,
} from '../../../tests/utils-events';
import {
  PlatypusOracleType,
  PlatypusConfigInfo,
  PlatypusPoolState,
} from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'Platypus';
const network = Network.AVALANCHE;
const config = PlatypusConfig[dexKey][network];
const poolIndex = 0;

async function fetchPoolState(
  platypusPool: PlatypusPool,
  blockNumber: number,
): Promise<PlatypusPoolState> {
  return await platypusPool.generateState(blockNumber);
}

describe('Platypus Event', function () {
  /*
  CashAdded [
    13967197, 13967347,
    13968151, 13968200,
    13968422, 13968513,
    13968690, 13968780,
    13968791, 13968951,
    13969056
  ]
  CashRemoved [
    13967310, 13967398,
    13967401, 13967705,
    13967832, 13967867,
    13968025, 13968138,
    13968467, 13968489,
    13968604, 13968978,
    13969060
  ]
  LiabilityAdded [ 13967398, 13967401, 13967705, 13967832, 13967867, 13968025 ]
  LiabilityRemoved [
    13967310, 13968138,
    13968467, 13968489,
    13968604, 13968978,
    13969060
  ]
  AnswerUpdated [ 13941238 ]
  HaircutRateUpdated [ 10134648 ]
  */
  const blockNumbers: { [eventName: string]: number[] } = {
    CashAdded: [13967197],
    CashRemoved: [13967398],
    LiabilityAdded: [13967401],
    LiabilityRemoved: [13967310],
    AnswerUpdated: [13941238],
    HaircutRateUpdated: [10134648],
  };

  describe('PlatypusPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);

          let cfgInfo = getSavedConfig<PlatypusConfigInfo>(blockNumber, dexKey);
          if (!cfgInfo) {
            const dex = new Platypus(network, dexKey, dexHelper);
            cfgInfo = await dex.generateConfigInfo(blockNumber);
            saveConfig(blockNumber, dexKey, cfgInfo);
          }

          const cfgInfoPool =
            cfgInfo.pools[config.pools[poolIndex].address.toLowerCase()];
          if (cfgInfoPool.oracleType !== PlatypusOracleType.ChainLink) {
            throw new Error('Wrong Platypus oracle type for this test!');
          }
          const platypusPool = new PlatypusPool(
            dexKey,
            network,
            config.pools[poolIndex].name,
            config.pools[poolIndex].address,
            cfgInfoPool,
            dexHelper,
          );

          await testEventSubscriber(
            platypusPool,
            platypusPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(platypusPool, _blockNumber),
            blockNumber,
            `${dexKey}_${config.pools[poolIndex].address}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
