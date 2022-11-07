import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { SwaapV1 } from './swaap-v1';
import { SwaapV1Pool } from './swaap-v1-pool';
import { SwaapV1Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { SwaapV1PoolState, SubgraphPoolBase } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'SwaapV1';
const network = Network.POLYGON;
const config = SwaapV1Config[dexKey][network];

const initBlock = new Map<string, number>([
  ['0x7f5f7411c2c7ec60e2db946abbe7dc354254870b', 29524183],
]);

async function getSubgraphPool(
  address: string,
  blockNumber: number,
): Promise<SubgraphPoolBase> {
  const id = address.toLowerCase();
  const query = `query ($blockNumber: Int, $id: Bytes!) {
    pools: pools(block: { number: $blockNumber }, where: {id: $id}) {
      id
      tokens {
        address
        decimals
        oracleInitialState {
          proxy
          price: fixedPointPrice
          decimals
        }
      }
      liquidity
      swapFee
      dynamicCoverageFeesZ
      dynamicCoverageFeesHorizon
      priceStatisticsLookbackInSec
      priceStatisticsLookbackInRound
      priceStatisticsLookbackStepInRound
      maxPriceUnpegRatio
    }
  }`;
  const variables = {
    blockNumber,
    id,
  };
  const data = await axios.post(
    config.subgraphURL,
    { query, variables },
    { timeout: 5000 },
  );
  return data.data.data.pools[0];
}

async function fetchOnePoolState(
  pool: SwaapV1Pool,
  blockNumber: number,
): Promise<SwaapV1PoolState> {
  const state = await pool.generateState(blockNumber);
  return state;
}

describe('SwaapV1 Event', function () {
  const blockNumbers: { [event: string]: [number, string][] } = {
    Swap: [
      [29831233, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'],
      [29830840, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'],
    ],
    Exit: [
      [29820384, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'],
      [29809164, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'],
    ],
    Join: [
      [29829227, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'], // Joinswap
      [29828025, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'],
    ],
    AnswerUpdated: [[29799898, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b']],
    LB_STEP_IN_ROUND_TOPIC: [
      [33424651, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b'],
    ],
    SWAP_FEE_TOPIC: [[33678249, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b']],
    Z_TOPIC: [[33679213, '0x7f5f7411c2c7ec60e2db946abbe7dc354254870b']],
  };

  describe('SwaapV1EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach(([blockNumber, poolAddress]) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);

          const startBlock = Math.max(
            initBlock.get(poolAddress)!,
            blockNumber - 1,
          );
          const startSubPool: SubgraphPoolBase = (
            await SwaapV1.initPools(dexHelper, startBlock, [
              await getSubgraphPool(poolAddress, startBlock),
            ])
          ).get(poolAddress.toLowerCase())!;
          const startSubPoolSwaapV1Pool = new SwaapV1Pool(
            dexKey,
            network,
            startSubPool,
            dexHelper,
          );

          const endSubPool: SubgraphPoolBase = (
            await SwaapV1.initPools(dexHelper, blockNumber, [
              await getSubgraphPool(poolAddress, blockNumber),
            ])
          ).get(poolAddress.toLowerCase())!;
          const endSubPoolSwaapV1Pool = new SwaapV1Pool(
            dexKey,
            network,
            endSubPool,
            dexHelper,
          );

          await testEventSubscriber(
            startSubPoolSwaapV1Pool,
            startSubPoolSwaapV1Pool.addressSubscribers,
            (_blockNumber: number) =>
              fetchOnePoolState(endSubPoolSwaapV1Pool, _blockNumber),
            blockNumber,
            `${dexKey}_${poolAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
