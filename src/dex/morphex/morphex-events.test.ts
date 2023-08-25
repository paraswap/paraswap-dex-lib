import dotenv from 'dotenv';
dotenv.config();

import { GMXEventPool } from '../gmx/pool';
import { MorphexConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from '../gmx/types';

jest.setTimeout(50 * 1000);
const dexKey = 'Morphex';

async function fetchPoolState(
  gmxPool: GMXEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return gmxPool.generateState(blockNumber);
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

describe('Morphex Fantom Events', function () {
  const network = Network.FANTOM;
  const params = MorphexConfig[dexKey][network];
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdgAmount: [
      67247602, 67247565, 67247561, 67247508, 67247393, 67247305, 67247303,
      67247302, 67247230, 67247220, 67247218, 67247216, 67247215, 67247145,
      67247059, 67247026, 67246788, 67246731,
    ],
    DecreaseUsdgAmount: [
      67247778, 67247602, 67247565, 67247561, 67247508, 67247393, 67247305,
      67247303, 67247302, 67247230, 67247220, 67247218, 67247216, 67247215,
      67247145, 67247059, 67247026, 67246788,
    ],
    Transfer: [
      67087282, 67087063, 67087039, 67068002, 67052880, 67052806, 67052801,
    ],
    PriceUpdate: [67248035, 67247977, 67247907, 67247897, 67247893],
  };

  describe('MorphexEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await GMXEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );
          const gmxPool = new GMXEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

          await testEventSubscriber(
            gmxPool,
            gmxPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(gmxPool, _blockNumber),
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

describe('Morphex BSC Events', function () {
  const network = Network.BSC;
  const params = MorphexConfig[dexKey][network];
  const blockNumbers: { [eventName: string]: number[] } = {
    IncreaseUsdgAmount: [
      31152256, 31138628, 31137790, 31137788, 31131427, 31123797, 31120641,
      31116766, 31116335, 31116205, 31115380, 31112437, 31112433, 31107317,
      31106077, 31106044, 31105166, 31104580, 31104252, 31104234, 31102490,
      31097010,
    ],
    DecreaseUsdgAmount: [
      31152256, 31137790, 31137788, 31136832, 31136830, 31136827, 31136825,
      31136823, 31136820, 31136818, 31136815, 31131427, 31112437, 31112433,
      31106077, 31106044, 31105166, 31104580, 31099233, 31099169, 31098990,
      31097010, 31093513,
    ],
    Transfer: [
      31138628, 31123797, 31120641, 31116766, 31116335, 31116205, 31115380,
      31107317, 31104252, 31104234, 31102490, 31099233, 31099233, 31099169,
    ],
    PriceUpdate: [31156757, 31156707, 31156648, 31156597, 31156526],
  };

  describe('MorphexEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const config = await GMXEventPool.getConfig(
            params,
            blockNumber,
            dexHelper.multiContract,
          );
          const gmxPool = new GMXEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
          );

          await testEventSubscriber(
            gmxPool,
            gmxPool.addressesSubscribed,
            (_blockNumber: number) => fetchPoolState(gmxPool, _blockNumber),
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
