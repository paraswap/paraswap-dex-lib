/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { AaveGsmEventPool } from './aave-gsm-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { AaveGsmConfig } from './config';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  aaveGsmPool: AaveGsmEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const eventState = aaveGsmPool.getState(blockNumber);
  if (eventState) return eventState;
  const onChainState = await aaveGsmPool.generateState(blockNumber);
  aaveGsmPool.setState(onChainState, blockNumber);
  return onChainState;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('AaveGsm EventPool Mainnet', function () {
  const dexKey = 'AaveGsm';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let aaveGsmPool: AaveGsmEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    [AaveGsmConfig[dexKey][network].GSM_USDT]: {
      FeeStrategyUpdated: [], // Hasn't been emitted yet
      BuyAsset: [20634073],
      SellAsset: [20641217, 20641520, 20641913],
      ExposureCapUpdated: [], // Hasn't been emitted yet
    },
  };

  beforeEach(async () => {
    aaveGsmPool = new AaveGsmEventPool(
      AaveGsmConfig[dexKey][network].GSM_USDT,
      dexKey,
      network,
      dexHelper,
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
                    aaveGsmPool,
                    aaveGsmPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(aaveGsmPool, _blockNumber, poolAddress),
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
