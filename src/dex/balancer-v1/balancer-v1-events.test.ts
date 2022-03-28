import dotenv from 'dotenv';
dotenv.config();

import { BalancerV1, BalancerV1EventPool } from './balancer-v1';
import { BalancerV1Config, SUBGRAPH_TIMEOUT } from './config';
import { Network } from '../../constants';
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

describe('BalancerV1 Event', function () {
  const testPoolAddress = '0x1eff8af5d577060ba4ac8a29a13525bb0ee2a3d5';
  const blockNumbers: { [event: string]: [number, string][] } = {
    LOG_JOIN: [
      [11379497, testPoolAddress],
      [11379555, testPoolAddress],
      [11380893, testPoolAddress],
      [11380933, testPoolAddress],
      [11381493, testPoolAddress],
      [11382001, testPoolAddress],
    ],
    LOG_EXIT: [
      [11376152, testPoolAddress],
      [11376280, testPoolAddress],
      [11377349, testPoolAddress],
      [11377998, testPoolAddress],
    ],
    LOG_SWAP: [
      [11376453, testPoolAddress],
      [11376550, testPoolAddress],
      [11378762, testPoolAddress],
      [11378773, testPoolAddress],
      [11378776, testPoolAddress],
      [11378856, testPoolAddress],
      [11378870, testPoolAddress],
    ],
  };

  describe('BalancerV1EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach(([blockNumber, poolAddress]) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const balancerV1Pools = new BalancerV1EventPool(
            dexKey,
            network,
            dexHelper,
            logger,
          );

          await testEventSubscriber(
            balancerV1Pools,
            balancerV1Pools.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(balancerV1Pools, _blockNumber, poolAddress),
            blockNumber,
            BalancerV1.getIdentifier(dexKey, poolAddress),
            dexHelper.provider,
          );
        });
      });
    });
  });
});
