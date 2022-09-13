import dotenv from 'dotenv';
dotenv.config();
import JarvisV6PoolABI from '../../abi/jarvis/jarvis-v6-pool.json';
import { JarvisV6EventPool } from './jarvis-v6-events';
import { JarvisV6Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { Interface } from '@ethersproject/abi';
import SynthereumPriceFeedABI from '../../abi/jarvis/SynthereumPriceFeed.json';

jest.setTimeout(50 * 1000);
const dexKey = 'JarvisV6';
const network = Network.POLYGON;
const config = JarvisV6Config[dexKey][network];
const poolInterface = new Interface(JarvisV6PoolABI);

async function fetchPoolState(
  jarvisV6Pools: JarvisV6EventPool,
  blockNumber: number,
): Promise<PoolState> {
  return jarvisV6Pools.generateState(blockNumber);
}

describe('JarvisV6 Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    AnswerUpdated: [32028524, 32028634, 32028644, 32028649],
    SetFeePercentage: [30825598],
  };

  describe('JarvisV6EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number, index: number) => {
        it(`Should return the correct state after the ${blockNumber}: ${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);
          const firstPool = config.pools[0];
          const priceFeedContract = new dexHelper.web3Provider.eth.Contract(
            SynthereumPriceFeedABI as any,
            config.priceFeedAddress,
          );
          const jarvisV6Pools = new JarvisV6EventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            firstPool,
            config.priceFeedAddress,
            poolInterface,
            priceFeedContract,
          );

          await testEventSubscriber(
            jarvisV6Pools,
            jarvisV6Pools.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(jarvisV6Pools, _blockNumber),
            blockNumber,
            `${dexKey}_${firstPool.address}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
