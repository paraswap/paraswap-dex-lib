/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../../constants';
import { UniswapV4Config } from '../uniswap-v4/config';
import { DummyDexHelper } from '../../dex-helper';
import { testEventSubscriber } from '../../../tests/utils-events';
import { UniswapV4PoolManager } from './uniswap-v4-pool-manager';
import { PoolManagerState, PoolState } from './types';
import { UniswapV4Pool } from './uniswap-v4-pool';

jest.setTimeout(500 * 1000);
const dexKey = 'UniswapV4';

async function fetchPoolStateFromContract(
  pool: UniswapV4Pool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `UniswapV4: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = await pool.generateState(blockNumber);
  console.log('state: ', state);
  console.log(`Done ${message}`);
  return state;
}

// async function fetchPoolManagerStateFromContract(
//   poolManager: UniswapV4PoolManager,
//   blockNumber: number,
//   poolAddress: string,
// ): Promise<PoolManagerState> {
//   const message = `UniswapV4: ${poolAddress} blockNumber ${blockNumber}`;
//   console.log(`Fetching state ${message}`);
//   // Be careful to not request state prior to contract deployment
//   // Otherwise need to use manual state sourcing from multicall
//   // We had that mechanism, but removed it with this commit
//   // You can restore it, but better just to find block after state multicall
//   // deployment
//   const state = await poolManager.generateState(blockNumber);
//   console.log('state: ', state);
//   console.log(`Done ${message}`);
//   return state;
// }

describe('UniswapV4 events', () => {
  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const config = UniswapV4Config[dexKey][network];

    describe('UniswapV4Pool', () => {
      const blockNumbers: { [eventName: string]: number[] } = {
        // ['Swap']: 21983404,
        // ['Donate']: 21983404,
        ['ModifyLiquidity']: [
          21752580, // https://etherscan.io/tx/0xe589ba9c13d857e3cb513d46d4adc47bb07bc722f1346394ff33f0b0d3239774#eventlog
          21779396, // https://etherscan.io/tx/0x74fca175197dd0dd562f6f3c9a86174122c7b0d0908ca2018b7f599c690998bd#eventlog
          21858734, // https://etherscan.io/tx/0xe242aa2c74bf87a26be0121724b2aebdb92d3e43dffd79d13390b8ea9db85ac2#eventlog
          21896080, // https://etherscan.io/tx/0x057babfb1612827bdcb9d602cbe2dc68845eab4b28aabdded1aed36da7439721#eventlog
          21936463, // https://etherscan.io/tx/0x61a4d0f824783f8488c60680a41668a1b5789f7635b6d4b690dc31330acad3ec#eventlog
          21936548, // https://etherscan.io/tx/0x12b182a4029b1922ff16f1be933c4f98b4adb8d35690a5455311c3f9984bbcbf#eventlog
          21946356, // https://etherscan.io/tx/0x2cebd437deaab46b7bfc5c2bc66e1774041eaf19e662fd722029662bb8678f2a#eventlog
          21952223, // https://etherscan.io/tx/0x1ec6671456e6b63182f8c7d39d1b106dbe9c6a1431bdfd32ce1bac97b9d76d3f#eventlog
          21971475, // https://etherscan.io/tx/0x13d9db5d359e375d0903400b3e4d1236a91bb2ab893192e6d9428073ca896561#eventlog
          21976909, // https://etherscan.io/tx/0xbd67fab1eb6b9ea262d2265ce1f74b80009cecb8e336d4e55a2f6fadf32fa6c4#eventlog
          21976916, // https://etherscan.io/tx/0x4a3466551f596ae4d1a8ae85d4b03ad0fd0aad92c2de887bf3b24fe26a439c14#eventlog
          22084065, // https://etherscan.io/tx/0x8669878222dcd5b43da1a2e53890adb66e18df4d1c70b2bbc4689e5b35c2bf50#eventlog
          22084366, // https://etherscan.io/tx/0x8791aae46a8a38a7a75aec9df7eedf5d013a26490463537f1dfdba9cb9b784dd#eventlog
        ],
      };

      Object.keys(blockNumbers).forEach((event: string) => {
        blockNumbers[event].forEach((blockNumber: number) => {
          it(`${event}:${blockNumber} - should return correct state`, async function () {
            const dexHelper = new DummyDexHelper(network);

            const logger = dexHelper.getLogger(dexKey);

            const uniswapV4Pool = new UniswapV4Pool(
              dexHelper,
              dexKey,
              network,
              config,
              logger,
              '',
              '0x8f4abe8df5872097e9f70f8b7141fcf6f42a7a176a35e6f2a998308acf0abd4e', // initial params from Initialize event
              '0x0000000000000000000000000000000000000000',
              '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1',
              '10000',
              '0x0000000000000000000000000000000000000000',
              7446534289545374680448599517924334n,
              '229030',
              '200',
            );

            await uniswapV4Pool.initialize(blockNumber);

            await testEventSubscriber(
              uniswapV4Pool,
              uniswapV4Pool.addressesSubscribed,
              (_blockNumber: number) =>
                fetchPoolStateFromContract(
                  uniswapV4Pool,
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

// describe('UniswapV4PoolManager', () => {
//   Object.keys(blockNumbers).forEach((event: string) => {
//     blockNumbers[event].forEach((blockNumber: number) => {
//       it(`${event}:${blockNumber} - should return correct state`, async function () {
//         const dexHelper = new DummyDexHelper(network);
//
//         const logger = dexHelper.getLogger(dexKey);
//         const uniswapV4PoolManager = new UniswapV4PoolManager(
//           dexHelper,
//           dexKey,
//           network,
//           config,
//           logger,
//         );
//
//         await testEventSubscriber(
//           uniswapV4PoolManager,
//           uniswapV4PoolManager.addressesSubscribed,
//           (_blockNumber: number) =>
//             fetchPoolManagerStateFromContract(
//               uniswapV4PoolManager,
//               _blockNumber,
//               config.poolManager,
//             ),
//           blockNumber,
//           `${dexKey}_${config.poolManager}`,
//           dexHelper.provider,
//         );
//       });
//     });
//   });
// });
