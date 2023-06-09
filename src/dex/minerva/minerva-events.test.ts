/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { MinervaEventPool } from './pool';
import { MinervaConfig } from './config';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'Minerva';
const network = Network.OPTIMISM;
const params = MinervaConfig[dexKey][network];

async function fetchPoolState(
  minervaPool: MinervaEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return minervaPool.generateState(blockNumber);
}

// timestamp can't be compared exactly as the event released
// doesn't have the timestamp. It is safe to consider the
// timestamp as the blockTime as the max deviation is bounded
// on the contract
const stateWithoutTimestamp = (state: PoolState) => ({
  ...state,
  secondaryPrices: {
    prices: state.secondaryPrices.prices,
    // timestamp (this is removed)
  },
});

function compareState(state: PoolState, expectedState: PoolState) {
  expect(stateWithoutTimestamp(state)).toEqual(
    stateWithoutTimestamp(expectedState),
  );
}

// not sure about this - STERLING//

describe('Minerva Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdmAmount: [],
    DecreaseUsdmAmount: [],
    Transfer: [],
    PriceUpdate: [],
  };

  describe('MinervaEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await MinervaEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );
          const minervaPool = new MinervaEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

          await testEventSubscriber(
            minervaPool,
            minervaPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(minervaPool, _blockNumber),
            blockNumber,
            `${dexKey}_${params.vault}`,
            dexHelper.provider,
            compareState,
          );
        });
      });
    });
  });
});
