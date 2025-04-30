/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { MiroMigratorEventState } from './miro-migrator-state';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { MiroMigratorState } from './types';
import { TRANSFER_TOPIC } from './constants';
import { MiroMigratorConfig } from './config';

jest.setTimeout(50 * 1000);

async function fetchMiroMigratorState(
  miroMigratorEventState: MiroMigratorEventState,
  blockNumber: number,
  poolAddress: string,
): Promise<MiroMigratorState> {
  const eventState = miroMigratorEventState.getState(blockNumber);
  if (eventState) return eventState;
  const onChainState = await miroMigratorEventState.generateState(blockNumber);
  miroMigratorEventState.setState(onChainState, blockNumber);
  return onChainState;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('MiroMigrator EventPool Optimism', function () {
  const dexKey = 'MiroMigrator';
  const network = Network.OPTIMISM;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let miroMigratorState: MiroMigratorEventState;

  const eventsToTest: Record<Address, EventMappings> = {
    [MiroMigratorConfig[dexKey][network].xyzTokenAddress]: {
      Transfer: [135131933, 135131948, 135134152, 135160597, 135162180],
    },
  };

  beforeEach(async () => {
    miroMigratorState = new MiroMigratorEventState(
      dexKey,
      network,
      dexHelper,
      logger,
      MiroMigratorConfig[dexKey][network].migratorAddress,
      MiroMigratorConfig[dexKey][network].xyzTokenAddress,
      TRANSFER_TOPIC,
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
                    miroMigratorState,
                    miroMigratorState.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchMiroMigratorState(
                        miroMigratorState,
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
