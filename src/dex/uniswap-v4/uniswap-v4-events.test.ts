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
import { Contract, ethers } from 'ethers';
import UniswapV4PoolManagerABI from '../../abi/uniswap-v4/pool-manager.abi.json';
import { Log } from 'web3-core';

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
        // ['Donate']: // Donate event was never triggered
        // ['ProtocolFeeUpdated']: // Donate event was never triggered
        // ['ModifyLiquidity']: [
        //   21752580, // https://etherscan.io/tx/0xe589ba9c13d857e3cb513d46d4adc47bb07bc722f1346394ff33f0b0d3239774#eventlog
        //   21779396, // https://etherscan.io/tx/0x74fca175197dd0dd562f6f3c9a86174122c7b0d0908ca2018b7f599c690998bd#eventlog
        //   21858734, // https://etherscan.io/tx/0xe242aa2c74bf87a26be0121724b2aebdb92d3e43dffd79d13390b8ea9db85ac2#eventlog
        //   21896080, // https://etherscan.io/tx/0x057babfb1612827bdcb9d602cbe2dc68845eab4b28aabdded1aed36da7439721#eventlog
        //   21936463, // https://etherscan.io/tx/0x61a4d0f824783f8488c60680a41668a1b5789f7635b6d4b690dc31330acad3ec#eventlog
        //   21936548, // https://etherscan.io/tx/0x12b182a4029b1922ff16f1be933c4f98b4adb8d35690a5455311c3f9984bbcbf#eventlog
        //   21946356, // https://etherscan.io/tx/0x2cebd437deaab46b7bfc5c2bc66e1774041eaf19e662fd722029662bb8678f2a#eventlog
        //   21952223, // https://etherscan.io/tx/0x1ec6671456e6b63182f8c7d39d1b106dbe9c6a1431bdfd32ce1bac97b9d76d3f#eventlog
        //   21971475, // https://etherscan.io/tx/0x13d9db5d359e375d0903400b3e4d1236a91bb2ab893192e6d9428073ca896561#eventlog
        //   21976909, // https://etherscan.io/tx/0xbd67fab1eb6b9ea262d2265ce1f74b80009cecb8e336d4e55a2f6fadf32fa6c4#eventlog
        //   21976916, // https://etherscan.io/tx/0x4a3466551f596ae4d1a8ae85d4b03ad0fd0aad92c2de887bf3b24fe26a439c14#eventlog
        //   22084065, // https://etherscan.io/tx/0x8669878222dcd5b43da1a2e53890adb66e18df4d1c70b2bbc4689e5b35c2bf50#eventlog
        //   22084366, // https://etherscan.io/tx/0x8791aae46a8a38a7a75aec9df7eedf5d013a26490463537f1dfdba9cb9b784dd#eventlog
        // ],
        ['Swap']: [
          // 21768564, // https://etherscan.io/tx/0xc5a568180b54e20ba457832f53a19b1623b8abbe446969fa28890de9661429ce#eventlog
          21768635, // https://etherscan.io/tx/0x7b3aea782a6710caf5d129d7e67d402fe9b94f73d80b8bfc67948ca6a9ed2f10#eventlog
          // 21771588, // https://etherscan.io/tx/0x04f769d4ef0d14d70900e54917531d469310d13dfe80f587d058363f090e3a5a#eventlog
          // 21771626, // https://etherscan.io/tx/0x3780ba5e4c2e75f17d40604238aaaca7b778c48b2da2e07d348ae3af3d470475#eventlog
          // 21773323, // https://etherscan.io/tx/0x54ae99e0d81fa4c6c746fc5f432da1a6cf3ffdfef87c1a35b33d18b3520dfd14#eventlog
          // 21774365, // https://etherscan.io/tx/0xdc65b4367f2b9ea8a2c59fae51d2bb64dd1f3a3bdc4a8ae27118589c1ceea29d#eventlog
          // 21775142, // https://etherscan.io/tx/0xffe17b60cb6bf50282480d2aee0fbbd04dd3b2ec503b2abf115c486b1ada4f36#eventlog
          // 21775682, // https://etherscan.io/tx/0x4cac2f7040d145c0b04ba03c8fd071073189cab3dbc4ab378b18b6f772cca5d5#eventlog
          // 21776125, // https://etherscan.io/tx/0x93d559cb54daa2bb323f16ed07ec50e8838195ea9ed9fbe78fdaa1173f55e52e#eventlog
          // 21776131, // https://etherscan.io/tx/0x839b6a1ce4bc7f19dec96868ef59c1774c88fc6698e843c08c0ea09d5d00ea12#eventlog
          // 21776132, // https://etherscan.io/tx/0x510bc279b57093adc92b9d28230391cd0972e596e2dec25cdf6cb872612a5ce3#eventlog
          // 21776168, // https://etherscan.io/tx/0x2761f08cf73a377cca6c248acc85e998e3155f5f8b8ace2e4ccd651fcc760d63#eventlog
          // 21777204, // https://etherscan.io/tx/0x3d8f4dd2d4a9ac8f03929efb3e2c0b697190dd8c27a410922d1c37e7b7b7d76a#eventlog
          // 21777469, // https://etherscan.io/tx/0x01bfd1136f451361db76340b350acbfa22acaaa3c9a58f660d392ea3b16bdd71#eventlog
          // 21777804, // https://etherscan.io/tx/0x98b6da140a70de1386f339aa8e486dccd75b0c4e62fabd43cec892e6e871fbae#eventlog
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

    it('get logs', async () => {
      const dexHelper = new DummyDexHelper(network);
      const contractAddr = '0x000000000004444c5dc75cb358380d2e3de08a90';

      const filter = {
        address: contractAddr,
        topics: [
          // ethers.utils.id('ProtocolFeeUpdated(bytes32,uint24)'), // no logs
          // ethers.utils.id('Donate(bytes32,address,uint256,uint256)'),
          // ethers.utils.id(
          //   'Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)',
          // ),
          // '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f', // Swap
        ],
      };

      const fromBlock = 21688329;
      const toBlock = 22130455;

      const blocksLimit = 10_000;

      let logs: Log[] = [];
      let latestBlock = fromBlock;

      while (latestBlock <= toBlock) {
        logs = logs.concat(
          await dexHelper.provider.getLogs({
            ...filter,
            fromBlock: latestBlock,
            toBlock: latestBlock + blocksLimit,
          }),
        );
        latestBlock = latestBlock + blocksLimit;
      }

      console.log('LOGS: ', logs);
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
