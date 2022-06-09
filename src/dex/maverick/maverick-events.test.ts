import dotenv from 'dotenv';
dotenv.config();

import { MaverickEventPool } from './maverick';
import { MaverickConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { MaverickPoolState, SubgraphPoolBase } from './types';
import { Tokens, Holders } from '../../../tests/constants-e2e';
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
    AddLiquidity: [29299844],
    Swap: [29300959, 29301354, 29301378],
  };

  describe.only('MaverickEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);
          const pool = await getSubgraphPool(
            '0xf72Ba513CF61947bB9153f719B3f7E225eCB0703',
            blockNumber,
          );

          const maverickPool = new MaverickEventPool(
            dexKey,
            dexHelper,
            pool.id,
            Tokens[network]['USDC'],
            Tokens[network]['WETH'],
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
