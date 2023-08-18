/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { AbiItem } from 'web3-utils';

import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';

import { KyberswapElasticEventPool } from './kyberswap-elastic-pool';
import { KyberswapElasticConfig } from './config';
import { PoolState } from './types';

jest.setTimeout(300 * 1000);
const dexKey = 'KyberswapElastic';
const network = Network.POLYGON;
const config = KyberswapElasticConfig[dexKey][network];

async function fetchPoolStateFromContract(
  kyberElasticPool: KyberswapElasticEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `KyberswapElastic: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  const state = kyberElasticPool.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

describe('KyberswapElastic Event', function () {
  const poolAddress = '0xc270E8bFddD1baeCB63f1F168cF16a5aF43F25F0';
  const swapFeeUnits = 2000n;
  const token0 = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'; // WETH
  const token1 = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'; // USDT

  const blockNumbers: { [eventName: string]: number[] } = {
    // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
    // ['Swap']: [
    //   46024527, 46368454, 46382161, 46389825, 46389828, 46389828, 46389905,
    //   46395887, 46396458, 46396509, 46396512, 46396541, 46396541, 46396543,
    //   46396547, 46396548, 46396549, 46396556, 46396557, 46396560, 46396563,
    //   46396563, 46396564, 46396571, 46396580,
    // ],
    // topic0 - 0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c
    ['Burn']: [
      45260896, 45263948, 45290305, 45330254, 45341040, 45341949, 45425145,
      45459592, 45464859, 45466043, 45692304, 45695126, 45762750, 45784950,
      45798307, 45804486, 45842608, 45912593, 45912624, 45941338, 46051321,
      46071378, 46072179, 46072190, 46389726,
    ],
    // topic0 - 0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde
    ['Mint']: [
      45174705, 45184373, 45199744, 45213105, 45229306, 45263615, 45264142,
      45341174, 45406729, 45425546, 45459953, 45465078, 45467700, 45474462,
      45775335, 45786522, 45793482, 45796144, 45826502, 45940379, 46028157,
      46031255, 46034973, 46064396, 46075469,
    ],
    // topic0 - 0x324487c99a1f7f0e3127499a548452d3a198e78ccd07add913cb93d59f0f039b
    ['BurnRTokens']: [
      44967218, 44994001, 44994020, 45034949, 45034955, 45035125, 45038758,
      45038878, 45038878, 45040353, 45040686, 45049542, 45052712, 45109985,
      45174213, 45212995, 45244232, 45290305, 45459729, 45464859, 45692304,
      45695126, 45730161, 45842608, 46432250,
    ],
  };

  describe('KyberswapElasticEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          const kyberElasticPool = new KyberswapElasticEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            config,
            swapFeeUnits,
            token0,
            token1,
          );

          // It is done in generateState. But here have to make it manually
          kyberElasticPool.poolAddress = poolAddress.toLowerCase();
          kyberElasticPool.addressesSubscribed[0] = poolAddress;

          await testEventSubscriber(
            kyberElasticPool,
            kyberElasticPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContract(
                kyberElasticPool,
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
  });
});
