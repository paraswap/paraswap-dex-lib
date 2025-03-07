/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../../constants';
import { UniswapV4Config } from '../uniswap-v4/config';
import { DummyDexHelper } from '../../dex-helper';
import { testEventSubscriber } from '../../../tests/utils-events';
import { UniswapV4PoolManager } from './uniswap-v4-pool-manager';
import { PoolManagerState } from './types';

jest.setTimeout(500 * 1000);
const dexKey = 'UniswapV4';

async function fetchPoolManagerStateFromContract(
  poolManager: UniswapV4PoolManager,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolManagerState> {
  const message = `UniswapV4: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = poolManager.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

describe('UniswapV4 events', () => {
  const blockNumbers: { [eventName: string]: number[] } = {
    ['Initialize']: [21983404, 21983412, 21983413, 21983417, 21983421],
  };

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const config = UniswapV4Config[dexKey][network];

    describe('UniswapV4PoolManager', () => {
      Object.keys(blockNumbers).forEach((event: string) => {
        blockNumbers[event].forEach((blockNumber: number) => {
          it(`${event}:${blockNumber} - should return correct state`, async function () {
            const dexHelper = new DummyDexHelper(network);

            const logger = dexHelper.getLogger(dexKey);
            const uniswapV4PoolManager = new UniswapV4PoolManager(
              dexHelper,
              dexKey,
              config.poolManager,
              config.stateView,
              config.subgraphURL,
              logger,
            );

            await testEventSubscriber(
              uniswapV4PoolManager,
              uniswapV4PoolManager.addressesSubscribed,
              (_blockNumber: number) =>
                fetchPoolManagerStateFromContract(
                  uniswapV4PoolManager,
                  _blockNumber,
                  config.poolManager,
                ),
              blockNumber,
              `${dexKey}_${config.poolManager}`,
              dexHelper.provider,
            );
          });
        });
      });
    });
  });
});
