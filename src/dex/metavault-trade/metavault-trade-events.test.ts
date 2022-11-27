import dotenv from 'dotenv';
dotenv.config();

import { MetavaultTradeEventPool } from './metavault-trade-pool';
import { MetavaultTradeConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { MetavaultTrade } from './metavault-trade';

jest.setTimeout(50 * 1000);
const dexKey = 'MetavaultTrade';
const network = Network.POLYGON;
const params = MetavaultTradeConfig[dexKey][network];

async function fetchPoolState(
  metavaultTradePool: MetavaultTradeEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return metavaultTradePool.generateState(blockNumber);
}

const stateWithoutTimestamp = (state: PoolState) => ({
  ...state,
  secondaryPrices: {
    prices: state.secondaryPrices.prices,
  },
});

function compareState(state: PoolState, expectedState: PoolState) {
  expect(stateWithoutTimestamp(state)).toEqual(
    stateWithoutTimestamp(expectedState),
  );
}

describe('MetavaultTrade', function () {
  let blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdmAmount: [
      36130344, 36130244, 36130144, 36130044, 36129844, 36129644,
    ],
    DecreaseUsdmAmount: [
      36130344, 36130244, 36130144, 36130044, 36129844, 36129644,
    ],
    PriceUpdate: [36130344, 36130244, 36130144, 36130044, 36129844, 36129644],
  };

  describe('MetavaultTradeEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const metavaultTrade = new MetavaultTrade(network, dexKey, dexHelper);

          const metavaultTradePool = await metavaultTrade.getEventPoolForBlock(
            blockNumber,
          );

          console.log(`${dexKey}_${params.vault}`);

          await testEventSubscriber(
            metavaultTradePool,
            metavaultTradePool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(metavaultTradePool, _blockNumber),
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
