/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { MantisSwap } from './mantis-swap';
import { MantisPool } from './pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import {
  testEventSubscriber,
  getSavedConfig,
  saveConfig,
} from '../../../tests/utils-events';
import { MantisPoolState } from './types';

import { MantisSwapConfig } from './config';
import { MantisConfigInfo } from './types';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  mantisPool: MantisPool,
  blockNumber: number,
): Promise<MantisPoolState> {
  //@ts-ignore
  return await mantisPool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('MantisSwap Event', function () {
  const dexKey = 'MantisSwap';
  const network = Network.POLYGON;
  const config = MantisSwapConfig[dexKey][network];
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let mantisSwapPool: MantisPool;

  const blockNumbers: { [eventName: string]: number[] } = {
    AssetUpdated: [42257876],
    LiabilityUpdated: [42251796],
    LPRatioUpdated: [40577388],
    RiskUpdated: [40562886],
  };

  describe('MantisPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);

          let cfgInfo = getSavedConfig<MantisConfigInfo>(blockNumber, dexKey);
          if (!cfgInfo) {
            const dex = new MantisSwap(network, dexKey, dexHelper);
            cfgInfo = await dex.generateConfigInfo(blockNumber);
            saveConfig(blockNumber, dexKey, cfgInfo);
          }

          const cfgInfoPool =
            cfgInfo.pools[config.pools[0].address.toLowerCase()];
          const mantisPool = new MantisPool(
            dexKey,
            network,
            config.pools[0].name,
            config.pools[0].address,
            cfgInfoPool,
            dexHelper,
          );

          await testEventSubscriber(
            mantisPool,
            mantisPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(mantisPool, _blockNumber),
            blockNumber,
            `${dexKey}_${config.pools[0].address}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
