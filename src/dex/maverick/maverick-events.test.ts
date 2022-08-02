import dotenv from 'dotenv';
dotenv.config();

import { MaverickEventPool } from './maverick-pool';
import { MaverickConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { MaverickPoolState, SubgraphPoolBase } from './types';
import { Tokens } from '../../../tests/constants-e2e';
import axios from 'axios';

jest.setTimeout(50 * 1000);
const dexKey = 'Maverick';
const network = Network.POLYGON;
const config = MaverickConfig[dexKey][network];

async function fetchPoolState(
  maverickPool: MaverickEventPool,
  blockNumber: number,
): Promise<MaverickPoolState> {
  return maverickPool.generateState(blockNumber);
}

async function getSubgraphPool(
  address: string,
  blockNumber: number,
): Promise<SubgraphPoolBase> {
  address = address.toLowerCase();

  const query = `query ($blockNumber: Int, $address: Bytes!) {
    pools(block: { number: $blockNumber }, where: {id: $address}) {
        id
        fee
        w
        h
        k
        paramChoice
        twauLookback
        uShiftMultiplier
        maxSpreadFee
        spreadFeeMultiplier
        protocolFeeRatio
        epsilon
        quoteBalance
        baseBalance
        base {
            id
            decimals
            symbol
        }
        quote {
            id
            decimals
            symbol
        }
    }
  }`;

  const variables = {
    blockNumber,
    address,
  };

  const data = await axios.post(
    config.subgraphURL,
    { query, variables },
    { timeout: 5000 },
  );
  return data.data.data.pools[0];
}

describe('Maverick Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    AddLiquidity: [30056745, 30066571, 30100670, 30101634, 30066571],
    RemoveLiquidity: [30056990, 30066638, 30102014, 30102040, 30102103],
    Swap: [30056881, 30056947, 30066500, 30066534, 30066607],
  };

  describe.only('MaverickEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);
          const pool = await getSubgraphPool(
            '0x515f36eb9a2ae11091949d8470ff808b8d6e57db',
            blockNumber,
          );
          const maverickPool = new MaverickEventPool(
            dexKey,
            dexHelper,
            pool.id,
            Tokens[network]['USDT'],
            Tokens[network]['USDC'],
            pool.fee,
            pool.w,
            pool.h,
            pool.k,
            pool.paramChoice,
            pool.twauLookback,
            pool.uShiftMultiplier,
            pool.maxSpreadFee,
            pool.spreadFeeMultiplier,
            pool.protocolFeeRatio,
            pool.epsilon,
            logger,
          );
          try {
            await testEventSubscriber(
              maverickPool,
              [pool.id],
              (_blockNumber: number) =>
                fetchPoolState(maverickPool, _blockNumber),
              blockNumber,
              `${dexKey}_${maverickPool.address}`,
              dexHelper.provider,
            );
          } catch (err) {
            console.log(err);
          }
        });
      });
    });
  });
});
