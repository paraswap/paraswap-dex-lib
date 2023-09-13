/* eslint-disable no-console */
import dotenv from 'dotenv';
import { ReservoirEventPool } from './reservoir-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { ReservoirPoolState, ReservoirPoolTypes } from './types';

dotenv.config();

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  reservoirEventPool: ReservoirEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<ReservoirPoolState> {
  const message = `Reservoir: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);

  const state = reservoirEventPool.generateState(blockNumber);
  console.log(`fetchPoolState done ${message}`);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Reservoir EventPool AVAX Mainnet', function () {
  const dexKey = 'Reservoir';
  const network = Network.AVALANCHE;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let reservoirEventPool: ReservoirEventPool;

  const USDT_USDC_STABLE_PAIR = '0x146D00567Cef404c1c0aAF1dfD2abEa9F260B8C7';

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    USDT_USDC_STABLE_PAIR: {
      Sync: [
        33021203, // event emitted at block 33021203 swap event
        33051184, // event emitted at block 33051184 swap event
        33754996, // event emitted at block 33754996 addLiq event
      ],
    },
  };

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  reservoirEventPool = new ReservoirEventPool(
                    dexKey,
                    dexHelper,
                    USDT_USDC_STABLE_PAIR,
                    {
                      address: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
                      decimals: 6,
                    },
                    {
                      address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
                      decimals: 6,
                    },
                    ReservoirPoolTypes.Stable,
                    logger,
                  );
                  reservoirEventPool.addressesSubscribed.push(
                    USDT_USDC_STABLE_PAIR,
                  );

                  await testEventSubscriber(
                    reservoirEventPool,
                    reservoirEventPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        reservoirEventPool,
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
