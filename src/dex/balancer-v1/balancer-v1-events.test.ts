import dotenv from 'dotenv';
dotenv.config();

import { BalancerV1, BalancerV1EventPool } from './balancer-v1';
import { BalancerV1Config } from './config';
import { Network, SUBGRAPH_TIMEOUT } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import axios from 'axios';
import { PoolState, PoolStateMap, PoolStates } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'BalancerV1';
const network = Network.MAINNET;
const config = BalancerV1Config[dexKey][network];

type SubgraphState = Omit<PoolState, 'tokensList' | 'publicSwap'>;

async function getSubgraphPool(
  address: string,
  blockNumber: number,
): Promise<SubgraphState> {
  address = address.toLowerCase();

  const query = `query ($blockNumber: Int, $address: ID!) {
    pools: pools(block: { number: $blockNumber }, where: {id: $address}) {
      id
      swapFee
      totalWeight
      tokens {
        address
        balance
        decimals
        denormWeight
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
    { timeout: SUBGRAPH_TIMEOUT },
  );
  return data.data.data.pools[0];
}

async function fetchPoolState(
  balancerV1Pools: BalancerV1EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolStateMap> {
  const fetchedState = await getSubgraphPool(poolAddress, blockNumber);
  const pools: PoolStates = {
    pools: [
      {
        ...fetchedState,
        tokensList: fetchedState.tokens.map(token => token.address),
      },
    ],
  };

  const poolsStates = await balancerV1Pools.getAllPoolDataOnChain(
    pools,
    blockNumber,
  );

  let poolStateMap: PoolStateMap = {};
  poolsStates.pools.forEach(
    pool => (poolStateMap[pool.id.toLowerCase()] = pool),
  );

  return poolStateMap;
}

export async function executeFullEventTest(
  blockNumber: number,
  poolAddress: string,
) {
  const dexHelper = new DummyDexHelper(network);
  await dexHelper.init();
  const logger = dexHelper.getLogger(dexKey);

  const balancerV1Pools = new BalancerV1EventPool(dexHelper, dexKey, logger);
  await balancerV1Pools.generateState(blockNumber - 1);
  await testEventSubscriber(
    balancerV1Pools,
    balancerV1Pools.addressesSubscribed,
    (_blockNumber: number) =>
      fetchPoolState(balancerV1Pools, _blockNumber, poolAddress),
    blockNumber,
    BalancerV1.getIdentifier(dexKey, poolAddress),
    dexHelper.provider,
  );
}

describe('BalancerV1 EventPool MAINNET', function () {
  const testPoolAddress = '0x1eff8af5d577060ba4ac8a29a13525bb0ee2a3d5';

  describe('LOG_JOIN', function () {
    const event = 'LOG_JOIN';

    it(`Return correct state after 11379497`, async function () {
      await executeFullEventTest(11379497, testPoolAddress);
    });
    it(`Return correct state after 11379555`, async function () {
      await executeFullEventTest(11379555, testPoolAddress);
    });
    it(`Return correct state after 11380893`, async function () {
      await executeFullEventTest(11380893, testPoolAddress);
    });
    it(`Return correct state after 11380933`, async function () {
      await executeFullEventTest(11380933, testPoolAddress);
    });
    it(`Return correct state after 11381493`, async function () {
      await executeFullEventTest(11381493, testPoolAddress);
    });
    it(`Return correct state after 11382001`, async function () {
      await executeFullEventTest(11382001, testPoolAddress);
    });
  });

  describe('LOG_EXIT', function () {
    const event = 'LOG_EXIT';

    it(`Return correct state after 11376152`, async function () {
      await executeFullEventTest(11376152, testPoolAddress);
    });
    it(`Return correct state after 11376280`, async function () {
      await executeFullEventTest(11376280, testPoolAddress);
    });
    it(`Return correct state after 11377349`, async function () {
      await executeFullEventTest(11377349, testPoolAddress);
    });
    it(`Return correct state after 11377998`, async function () {
      await executeFullEventTest(11377998, testPoolAddress);
    });
  });

  describe('LOG_SWAP', function () {
    const event = 'LOG_SWAP';

    it(`Return correct state after 11376453`, async function () {
      await executeFullEventTest(11376453, testPoolAddress);
    });
    it(`Return correct state after 11376550`, async function () {
      await executeFullEventTest(11376550, testPoolAddress);
    });
    it(`Return correct state after 11378762`, async function () {
      await executeFullEventTest(11378762, testPoolAddress);
    });
    it(`Return correct state after 11378773`, async function () {
      await executeFullEventTest(11378773, testPoolAddress);
    });
    it(`Return correct state after 11378776`, async function () {
      await executeFullEventTest(11378776, testPoolAddress);
    });
    it(`Return correct state after 11378856`, async function () {
      await executeFullEventTest(11378856, testPoolAddress);
    });
    it(`Return correct state after 11378870`, async function () {
      await executeFullEventTest(11378870, testPoolAddress);
    });
  });
});
