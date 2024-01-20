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
import _ from 'lodash';

jest.setTimeout(50 * 1000);
const dexKey = 'JarvisV6';
const network = Network.POLYGON;
const poolInterface = new Interface(JarvisV6PoolABI);

async function fetchPoolState(
  jarvisV6Pools: JarvisV6EventPool,
  blockNumber: number,
): Promise<PoolState> {
  return jarvisV6Pools.generateState(blockNumber);
}

function getFilteredDexParams(
  dexKey: string,
  network: number,
  pairToKeep: string[],
) {
  const poolConfig = JarvisV6Config[dexKey][network].pools.filter(pool =>
    pairToKeep.includes(pool.pair),
  );
  const chainLinkConfigs = _.pick(
    JarvisV6Config[dexKey][network].chainLink,
    pairToKeep,
  );
  return { poolConfig, chainLinkConfigs };
}

describe('JarvisV6 Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    AnswerUpdated: [35028524, 40373199],
    SetFeePercentage: [30825598],
  };

  describe('JarvisV6EventPool', function () {
    const { poolConfig, chainLinkConfigs } = getFilteredDexParams(
      dexKey,
      network,
      ['EURUSD'],
    );

    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number, index: number) => {
        it(`Should return the correct state after the ${blockNumber}: ${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const chainLinksEventsMap =
            await JarvisV6EventPool.getChainLinkSubscriberMap(
              chainLinkConfigs,
              dexKey,
              dexHelper,
              network,
              blockNumber,
            );
          const jarvisV6Pools = new JarvisV6EventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            poolConfig[0],
            _.pick(chainLinksEventsMap, ['EURUSD']),
            poolInterface,
          );

          await testEventSubscriber(
            jarvisV6Pools,
            jarvisV6Pools.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(jarvisV6Pools, _blockNumber),
            blockNumber,
            `${dexKey}_${poolConfig[0].address}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
