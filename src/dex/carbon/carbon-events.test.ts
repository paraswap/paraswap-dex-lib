/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { CarbonEventPool } from './carbon-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { CarbonConfig } from './config';
import { DeepReadonly } from 'ts-essentials';

jest.setTimeout(300 * 1000);
const dexKey = 'Carbon';
const network = Network.MAINNET;
const config = CarbonConfig[dexKey][network];

async function fetchPoolState(
  carbonPools: CarbonEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<PoolState>> {
  const message = `Carbon: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);

  const state = carbonPools.generateState(blockNumber);

  console.log(`Done ${message}`);

  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Carbon EventPool Mainnet', function () {
  const dexKey = 'Carbon';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let carbonPool: CarbonEventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0xC537e898CD774e2dCBa3B14Ea6f34C93d5eA45e1': {
      StrategyCreated: [
        17423908, 17424211, 17431166, 17434428, 17465333, 17465426, 17432734,
      ],
      StrategyUpdated: [17464816, 17465170, 17465350],
      StrategyDeleted: [
        17415410, 17416581, 17441070, 17448138, 17449924, 17451375,
      ],
    },
  };

  beforeEach(async () => {
    // carbonPool = new CarbonEventPool(dexKey, network, dexHelper, logger);
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  const dexHelper = new DummyDexHelper(network);
                  const logger = dexHelper.getLogger(dexKey);

                  const carbonPools = new CarbonEventPool(
                    dexKey,
                    network,
                    dexHelper,
                    logger,
                  );

                  await testEventSubscriber(
                    carbonPools,
                    carbonPools.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(carbonPools, _blockNumber, poolAddress),
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
