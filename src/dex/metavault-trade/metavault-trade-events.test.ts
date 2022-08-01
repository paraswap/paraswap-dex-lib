import dotenv from 'dotenv';
dotenv.config();

import { MetavaultTradeEventPool } from './pool';
import { MetavaultTradeConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

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

function compareState(state: PoolState, expectedState: PoolState) {
  // timestamp can't be compared exactly as the event released
  // doesn't have the timepstamp. It is safe to consider the
  // timestamp as the blocktime as the max deviation is bounded
  // on the contract.
  const stateWitoutTimestamp = (state: PoolState) => ({
    ...state,
    secondaryPrices: {
      prices: state.secondaryPrices.prices,
      // timestamp (this is removed)
    },
  });
  expect(stateWitoutTimestamp(state)).toEqual(
    stateWitoutTimestamp(expectedState),
  );
}

describe('MetavaultTrade Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdmAmount: [
      14181556, 14181609, 14181651, 14181679, 14181743, 14181795, 14181796,
      14181803, 14181806, 14181809,
    ],
    DecreaseUsdmAmount: [
      14181556, 14181609, 14181743, 14181795, 14181796, 14181803, 14181806,
      14181809, 14181814, 14181819,
    ],
    Transfer: [
      14186106, 14186126, 14186126, 14186171, 14187031, 14187301, 14187440,
      14187955, 14187955, 14187991,
    ],
    PriceUpdate: [
      14186352, 14186352, 14186352, 14186353, 14186353, 14186353, 14186336,
      14186336, 14186336, 14186351, 14186351, 14186351,
    ],
  };

  describe('MetavaultTradeEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await MetavaultTradeEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );

          const metavaultTradePool = new MetavaultTradeEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

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
