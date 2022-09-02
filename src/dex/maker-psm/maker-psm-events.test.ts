import dotenv from 'dotenv';
dotenv.config();

import { MakerPsmEventPool } from './maker-psm';
import { MakerPsmConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import axios from 'axios';

jest.setTimeout(50 * 1000);
const dexKey = 'MakerPsm';
const network = Network.MAINNET;
const config = MakerPsmConfig[dexKey][network];

function fetchPoolState(
  makerPsmPool: MakerPsmEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return makerPsmPool.generateState(blockNumber);
}

describe('MakerPsm Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    File: [12601940, 13108692, 13588198],
    SellGem: [14533443, 14534868, 14536572, 14536579, 14537918],
    BuyGem: [
      14535719, 14536218, 14536587, 14536590, 14536704, 14537147, 14537633,
      14537770, 14538002,
    ],
  };

  describe('MakerPsmEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          await dexHelper.init();
          const logger = dexHelper.getLogger(dexKey);

          const makerPsmPool = new MakerPsmEventPool(
            dexHelper,
            dexKey,
            config.pools[0],
            config.vatAddress,
            logger,
          );

          await testEventSubscriber(
            makerPsmPool,
            makerPsmPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(makerPsmPool, _blockNumber),
            blockNumber,
            `${dexKey}_${config.pools[0].psmAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
