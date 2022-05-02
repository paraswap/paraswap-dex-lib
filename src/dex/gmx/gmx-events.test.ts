import dotenv from 'dotenv';
dotenv.config();

import { GMXEventPool } from './pool';
import { GMXConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'GMX';
const network = Network.AVALANCHE;
const params = GMXConfig[dexKey][network];

async function fetchPoolState(
  gmxPool: GMXEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return gmxPool.generateState(blockNumber);
}

describe('GMX Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdgAmount: [
      14181556, 14181609, 14181651, 14181679, 14181743, 14181795, 14181796,
      14181803, 14181806, 14181809,
    ],
    DecreaseUsdgAmount: [
      14181556, 14181609, 14181743, 14181795, 14181796, 14181803, 14181806,
      14181809, 14181814, 14181819,
    ],
    Transfer: [
      14186106, 14186126, 14186126, 14186171, 14187031, 14187301, 14187440,
      14187955, 14187955, 14187991,
    ],
    PriceUpdate: [
      14186352, 14186352, 14186352, 14186353, 14186353, 14186353, 14186336,
      14186336, 14186336, 14186351, 14186351, 14186351,
    ],
  };

  describe('GmxEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await GMXEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );
          const gmxPool = new GMXEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

          await testEventSubscriber(
            gmxPool,
            gmxPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(gmxPool, _blockNumber),
            blockNumber,
            `${dexKey}_${params.vault}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
