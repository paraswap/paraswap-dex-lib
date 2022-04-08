import dotenv from 'dotenv';
dotenv.config();
import _ from 'lodash';
import { NerveEventPool } from './nerve-pool';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { typeCastPoolState } from './utils';
import { Nerve } from './nerve';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  nervePool: NerveEventPool,
  blockNumber: number,
): Promise<PoolState> {
  // It generates data from onchain data
  return typeCastPoolState(
    _.cloneDeep(await nervePool.generateState(blockNumber)),
  );
}

describe('Nerve Event Pool BSC', async () => {
  const dexKey = 'Nerve';
  const network = Network.BSC;

  const testPoolAddress = '0x1B3771a66ee31180906972580adE9b81AFc5fCDc'; // 3Pool
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);

  const nervePool = new NerveEventPool(dexKey, network, dexHelper, logger);

  // AddLiquidity: [[1, test3PoolAddress]],
  // RemoveLiquidity: [[1, test3PoolAddress]],
  // RemoveLiquidityOne: [[1, test3PoolAddress]],
  // RemoveLiquidityImbalance: [[1, test3PoolAddress]],
  // NewAdminFee: [[1, test3PoolAddress]],
  // NewSwapFee: [[1, test3PoolAddress]],
  // NewDepositFee: [[1, test3PoolAddress]],
  // NewWithdrawFee: [[1, test3PoolAddress]],
  // RampA: [[1, test3PoolAddress]],
  // StopRampA: [[1, test3PoolAddress]],

  describe('TokenSwap', () => {
    it(`State after 16773407`, async () => {
      const blockNumber = 16773407;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    // it(`State after 16772734`, async function () {
    //   const blockNumber = 16772734;
    //   await testEventSubscriber(
    //     nervePools,
    //     nervePools.addressesSubscribed,
    //     (_blockNumber: number) => fetchPoolState(nervePools, _blockNumber),
    //     blockNumber,
    //     `${dexKey}_${testPoolAddress}`,
    //     dexHelper.provider,
    //   );
    // });
    // it(`State after 16772624`, async function () {
    //   const blockNumber = 16772624;
    //   await testEventSubscriber(
    //     nervePools,
    //     nervePools.addressesSubscribed,
    //     (_blockNumber: number) => fetchPoolState(nervePools, _blockNumber),
    //     blockNumber,
    //     `${dexKey}_${testPoolAddress}`,
    //     dexHelper.provider,
    //   );
    // });
    // it(`State after 16771956`, async function () {
    //   const blockNumber = 16771956;
    //   await testEventSubscriber(
    //     nervePools,
    //     nervePools.addressesSubscribed,
    //     (_blockNumber: number) => fetchPoolState(nervePools, _blockNumber),
    //     blockNumber,
    //     `${dexKey}_${testPoolAddress}`,
    //     dexHelper.provider,
    //   );
    // });
    // it(`State after 16771221`, async function () {
    //   const blockNumber = 16771221;
    //   await testEventSubscriber(
    //     nervePools,
    //     nervePools.addressesSubscribed,
    //     (_blockNumber: number) => fetchPoolState(nervePools, _blockNumber),
    //     blockNumber,
    //     `${dexKey}_${testPoolAddress}`,
    //     dexHelper.provider,
    //   );
    // });
  });
});
