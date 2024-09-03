/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { AaveGsmEventPool } from './aave-gsm-pool';
import { AaveGsmConfig } from './config';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'AaveGsm';
const network = Network.MAINNET;
const config = AaveGsmConfig[dexKey][network];

async function fetchPoolState(
  aaveGsmPool: AaveGsmEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return aaveGsmPool.generateState(blockNumber);
}

describe('AaveGsm Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    BuyAsset: [20342417, 20336326, 20336310],
    SellAsset: [20460924, 20460917, 20460910],
    SwapFreeze: [],
    Seized: [],
  };

  describe('AaveGsmEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const aaveGsmPool = new AaveGsmEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config.pools[0],
          );

          await testEventSubscriber(
            aaveGsmPool,
            aaveGsmPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(aaveGsmPool, _blockNumber),
            blockNumber,
            `${dexKey}_${config.pools[0].gsmAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
