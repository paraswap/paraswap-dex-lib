import dotenv from 'dotenv';
dotenv.config();

import { UniswapV3EventPool } from './uniswap-v3';
import { UniswapV3Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'UniswapV3';
const network = Network.MAINNET;
const config = UniswapV3Config[dexKey][network];

async function fetchPoolState(
  uniswapV3Pools: UniswapV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  // TODO: complete me!
}

describe('UniswapV3 Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    // TODO: complete me!
  };

  describe('UniswapV3EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const uniswapV3Pools = new UniswapV3EventPool(
            dexKey,
            network,
            dexHelper,
            logger,
          );

          await testEventSubscriber(
            uniswapV3Pools,
            uniswapV3Pools.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(uniswapV3Pools, _blockNumber, poolAddress),
            blockNumber,
            `${dexKey}_${poolAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
