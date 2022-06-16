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
  const poolAddress = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
  const blockNumbers: { [eventName: string]: number[] } = {
    // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
    ['Swap']: [
      14973668, 14973666, 14973665, 14973664, 14973663, 4973662, 14973661,
    ],
    // topic0 - 0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c
    ['Burn']: [14973650, 14973586, 14973558, 14973552, 14973547],
    // topic0 - 0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde
    ['Mint']: [14973657, 14973641, 14973619, 14973589, 14973552],
    // topic0 - 0x973d8d92bb299f4af6ce49b52a8adb85ae46b9f214c4c4fc06ac77401237b133
    ['SetFeeProtocol']: [],
    // topic0 - 0xac49e518f90a358f652e4400164f05a5d8f7e35e7747279bc3a93dbf584e125a
    ['IncreaseObservationCardinalityNext']: [13125816, 12733621, 12591465],
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
