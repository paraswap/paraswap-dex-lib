/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { AngleStakedStableEventPool } from './angle-staked-stable-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { AngleStakedStableConfig } from './config';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  angleStakedStablePools: AngleStakedStableEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  return angleStakedStablePools.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('AngleStakedStable EventPool Mainnet', () => {
  const dexKey = 'AngleStakedStableEUR';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let angleStakedStablePool: AngleStakedStableEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x004626a008b1acdc4c74ab51644093b155e59a23': {
      Accrued: [
        19368181, 19387091, 19387136, 19390671, 19395050, 19395068, 19404404,
        19404492, 19407830, 19410813, 19482839, 19575712, 19622932, 19622960,
        19632489, 19650535, 19668024, 19668335, 19669259, 19672358, 19675559,
        19679409,
      ],
      Deposit: [
        19387091, 19387136, 19395050, 19404404, 19410813, 19622932, 19622960,
        19632489, 19668335, 19669259, 19672358, 19675559,
      ],
      Withdraw: [
        19368181, 19390671, 19395068, 19404492, 19407830, 19482839, 19575712,
        19650535, 19679409,
      ],
      ToggledPause: [],
      RateUpdated: [19668024],
    },
  };

  beforeEach(async () => {
    angleStakedStablePool = new AngleStakedStableEventPool(
      dexKey,
      network,
      dexHelper,
      AngleStakedStableConfig[dexKey][network].stakeToken,
      AngleStakedStableConfig[dexKey][network].agToken,
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
                it(`State after ${blockNumber}`, async () => {
                  await testEventSubscriber(
                    angleStakedStablePool,
                    angleStakedStablePool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        angleStakedStablePool,
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
