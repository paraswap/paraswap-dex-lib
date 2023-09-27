import dotenv from 'dotenv';
dotenv.config();

import { QuickPerpsEventPool } from './pool';
import { QuickPerpsConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolConfig, PoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'QuickPerps';
const network = Network.ZKEVM;
const params = QuickPerpsConfig[dexKey][network];
const dexHelper = new DummyDexHelper(network);
const logger = dexHelper.getLogger(dexKey);

async function fetchPoolState(
  quickPerpsPool: QuickPerpsEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return quickPerpsPool.generateState(blockNumber);
}

// timestamp can't be compared exactly as the event released
// doesn't have the timestamp. It is safe to consider the
// timestamp as the blockTime as the max deviation is bounded
// on the contract
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

describe('QuickPerps Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdqAmount: [
      4960808, 4960808, 4961034, 4961037, 4961046, 4961052, 4961055, 4961062,
      4961153, 4961167, 4961190, 4961194, 4961215, 4961220, 4961353, 4961472,
      4961476, 4961521, 4961628, 4961629, 4961648, 4961664, 4961683, 4961710,
      4961716, 4961848, 4961853, 4961863, 4961866, 4962156, 4962180, 4962200,
      4962296,
    ],
    DecreaseUsdqAmount: [
      4960808, 4960808, 4961034, 4961037, 4961046, 4961052, 4961055, 4961062,
      4961153, 4961167, 4961190, 4961194, 4961215, 4961220, 4961353, 4961472,
      4961476, 4961521, 4961628, 4961629, 4961648, 4961664, 4961683, 4961710,
      4961716, 4961848, 4961853, 4961863, 4961866, 4962156, 4962180, 4962200,
      4962296,
    ],
    Transfer: [4958541, 4959994, 4959998, 4960452, 4960452],
    PriceUpdate: [
      4960534, 4960569, 4960584, 4960609, 4960637, 4960660, 4960694, 4960700,
    ],
  };

  describe('QuickPerpsEventPool', function () {
    let config: PoolConfig;
    let quickPerpsPool: QuickPerpsEventPool;
    let blockNumber: number;
    beforeAll(async function () {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();

      config = await QuickPerpsEventPool.getConfig(
        params,
        blockNumber,
        dexHelper.multiContract,
      );
    });
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          quickPerpsPool = new QuickPerpsEventPool(
            dexKey,
            network,
            dexHelper,
            config,
          );
          await testEventSubscriber(
            quickPerpsPool,
            quickPerpsPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(quickPerpsPool, _blockNumber),
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
