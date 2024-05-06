/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VerifiedEventPool } from './verified-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolStateMap } from './types';
import { VerifiedConfig } from './config';

jest.setTimeout(50 * 1000);
async function fetchPoolState(
  verifiedPool: VerifiedEventPool,
  blockNumber: number,
): Promise<PoolStateMap> {
  return await verifiedPool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Verified EventPool on Polygon', function () {
  const parentName = 'Verified'; //DexKey or DexName
  const network = Network.POLYGON;
  const networkConfig = VerifiedConfig[parentName][network];
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(parentName);

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    //primary pool
    '0x3ed80e36afea962a04f6f1e3494a320c692d5daf': {
      Swap: [56608467], //change block when known primary pool address changes or add more
    },

    //secondary pool
    '0x0ac6afebbdc99e152b8d359ea5352af798550f05': {
      Swap: [56608467], //change block when known secondary pool address changes or add more
    },
  };
  let verifiedPool: VerifiedEventPool;
  beforeEach(async () => {
    verifiedPool = new VerifiedEventPool(
      parentName,
      network,
      dexHelper,
      networkConfig.vaultAddress,
      networkConfig.subGraphUrl,
      logger,
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
                    verifiedPool,
                    verifiedPool.addressesSubscribed,
                    async (_blockNumber: number) =>
                      await fetchPoolState(verifiedPool, _blockNumber),
                    blockNumber,
                    `${parentName}_${poolAddress}`,
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
