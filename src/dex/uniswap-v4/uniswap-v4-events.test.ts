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

    describe('UniswapV4Pool ETH / TITANX (0x8f4abe8df5872097e9f70f8b7141fcf6f42a7a176a35e6f2a998308acf0abd4e)', () => {
      const blockNumbers: { [eventName: string]: number[] } = {
        // ['Donate']: // Donate event was never triggered
        // ['ProtocolFeeUpdated']: // Donate event was never triggered
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
        ['Swap']: [
          21768564, // https://etherscan.io/tx/0xc5a568180b54e20ba457832f53a19b1623b8abbe446969fa28890de9661429ce#eventlog
          21768635, // https://etherscan.io/tx/0x7b3aea782a6710caf5d129d7e67d402fe9b94f73d80b8bfc67948ca6a9ed2f10#eventlog
          21771588, // https://etherscan.io/tx/0x04f769d4ef0d14d70900e54917531d469310d13dfe80f587d058363f090e3a5a#eventlog
          21771626, // https://etherscan.io/tx/0x3780ba5e4c2e75f17d40604238aaaca7b778c48b2da2e07d348ae3af3d470475#eventlog
          21773323, // https://etherscan.io/tx/0x54ae99e0d81fa4c6c746fc5f432da1a6cf3ffdfef87c1a35b33d18b3520dfd14#eventlog
          21774365, // https://etherscan.io/tx/0xdc65b4367f2b9ea8a2c59fae51d2bb64dd1f3a3bdc4a8ae27118589c1ceea29d#eventlog
          21775142, // https://etherscan.io/tx/0xffe17b60cb6bf50282480d2aee0fbbd04dd3b2ec503b2abf115c486b1ada4f36#eventlog
          21775682, // https://etherscan.io/tx/0x4cac2f7040d145c0b04ba03c8fd071073189cab3dbc4ab378b18b6f772cca5d5#eventlog
          21776125, // https://etherscan.io/tx/0x93d559cb54daa2bb323f16ed07ec50e8838195ea9ed9fbe78fdaa1173f55e52e#eventlog
          21776131, // https://etherscan.io/tx/0x839b6a1ce4bc7f19dec96868ef59c1774c88fc6698e843c08c0ea09d5d00ea12#eventlog
          21776132, // https://etherscan.io/tx/0x510bc279b57093adc92b9d28230391cd0972e596e2dec25cdf6cb872612a5ce3#eventlog
          21776168, // https://etherscan.io/tx/0x2761f08cf73a377cca6c248acc85e998e3155f5f8b8ace2e4ccd651fcc760d63#eventlog
          21777204, // https://etherscan.io/tx/0x3d8f4dd2d4a9ac8f03929efb3e2c0b697190dd8c27a410922d1c37e7b7b7d76a#eventlog
          21777469, // https://etherscan.io/tx/0x01bfd1136f451361db76340b350acbfa22acaaa3c9a58f660d392ea3b16bdd71#eventlog
          21777804, // https://etherscan.io/tx/0x98b6da140a70de1386f339aa8e486dccd75b0c4e62fabd43cec892e6e871fbae#eventlog
          21779284, // https://etherscan.io/tx/0x91625b97865d817f70cc24b4ce86f9997efd319a5840223b27128cc35ca09079#eventlog
          21858738, // https://etherscan.io/tx/0x4aac0b8b38d9dfc89480e41518265405e60a78cea6962a49790249560e8bbba5#eventlog
          21858872, // https://etherscan.io/tx/0xd318d4486cfd49afe9d3fee54f2857747fe685a9e921c4aa9df794fc161fdd38#eventlog
          21859176, // https://etherscan.io/tx/0x6535f96a6dac9a7353cf7bdafd1ecc9b1abc82cdd37b988c63acfeb823f138e5#eventlog
          21859639, // https://etherscan.io/tx/0x3b2506a09a779f8e9a2330b236d843a7c979f8962751f5fbe161836422978739#eventlog
          21859691, // https://etherscan.io/tx/0x7c186ec989254079c1fd92a444745cf6378eb3a6d31d726ba89ae2ba4ef9f033#eventlog
          21860941, // https://etherscan.io/tx/0xfdbb947c1645d70927885401b0c0d5ce2823b0aeacf185c76ed3714ab7c84e9f#eventlog
          21862001, // https://etherscan.io/tx/0x464f456bc7b38c6b544aa44481560d6a5e17661615098bc96ab1dba597d7b6a9#eventlog
          21862706, // https://etherscan.io/tx/0x66d7808ca65b0eba8fd3b1c617229d728390b4aa07cd8a283fa4482ad14eaa3e#eventlog
          21862782, // https://etherscan.io/tx/0xb206c313365e9f12017750ef0a2a0f929f8fb2bec8cf13a2718e5c2dbb67d437#eventlog
          21863208, // https://etherscan.io/tx/0xa2e876a9fb4cf542bc7187742f538fe469839b5bf4bcd8e901edb2b880dc0fc0#eventlog
          21864617, // https://etherscan.io/tx/0x7333cf48923502816f288d65f12ac73b79cdd388b8b88e5e4ace502631dcad75#eventlog
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

    describe('UniswapV4Pool USDC / WETH (0x4f88f7c99022eace4740c6898f59ce6a2e798a1e64ce54589720b7153eb224a7)', () => {
      const blockNumbers: { [eventName: string]: number[] } = {
        // ['Donate']: // Donate event was never triggered
        // ['ProtocolFeeUpdated']: // Donate event was never triggered
        ['ModifyLiquidity']: [
          21695956, // https://etherscan.io/tx/0x4e63fcc0dd42a2b317e77d17e236cadf77464a08ccece33a354bd8648b5f7419#eventlog
          21696049, // https://etherscan.io/tx/0x7c2414870e533cfe19fa952334d11930ce5d584a746ed852654d6c6eadcc019e#eventlog
          21696148, // https://etherscan.io/tx/0x532d7f26b9fd148d54f1096848c9a447e6f6513ab3bb9c6151267a5c87c5d175#eventlog
          21696208, // https://etherscan.io/tx/0xcaee5112fe4d2e68842ebe42c469822bfe884bac409a670a7572fe911b63560e#eventlog
          21696324, // https://etherscan.io/tx/0x09a586e81feefc5cfaf3dfc3b24bcaa1b362eb52e2dde6820fb1f8bea1504c43#eventlog
          21696326, // https://etherscan.io/tx/0xb72294c5d43e431670a7ddd865e8e708c150fcbed82e9e4bc311bed9eae8c098#eventlog
          21696327, // https://etherscan.io/tx/0x0b95ba21188a6387b8e0e67493ba0a9859da3b454a95ba1175b38502d9b13579#eventlog
          21696345, // https://etherscan.io/tx/0xa963ae09d5003968f6b9659156cbcea0d1032445ee9b0282197a5a383709c2e5#eventlog
          21696356, // https://etherscan.io/tx/0x56b9a3e8243b30bb720b0c6002d4c2421d8bd12fce090721d5ec3c96296d6c2f#eventlog
          21696369, // https://etherscan.io/tx/0x0bc80062d462d8d7d25457888bb6074c2a7c228a2ae45236e9e028796300fbb1#eventlog
          21696509, // https://etherscan.io/tx/0x6c6de87fb0a64b781a3c5cb8dbd0c7c66b978c3505831edf0cb332768de48f8e#eventlog
        ],
        ['Swap']: [
          21696375, // https://etherscan.io/tx/0xa6ec9dabbd0f80bdb2d9d5f1da8006939af385ec83874363b5a85b99dde51164#eventlog
          21696522, // https://etherscan.io/tx/0xd2ab25af0692ce646a920d325b6e53d26b2b2ac0cce788e20362f880ae44c7cc#eventlog
          21696530, // https://etherscan.io/tx/0x966a949326d0b3aba5d41c7e8fda72b585fb5f5eb4378a2ccddb82836df92711#eventlog
          21705269, // https://etherscan.io/tx/0x6f040804ba407caf2d827ed535038d543dbb77776fcf6590b584c4bdde65a9d0#eventlog
          21710994, // https://etherscan.io/tx/0xa9e870ac3228dfbf415f41e5a265200251213a477470cec71acdd45a5dd231ba#eventlog
          21719138, // https://etherscan.io/tx/0xe3d14a7b8ab08b536e449bb1f819cd108dbcc950ee7b1eac8a35941592508b72#eventlog
          21719294, // https://etherscan.io/tx/0x556f4ac648e15b5351f390a15d24877bcc669019ce002b6c4c0972cf3df74cdf#eventlog
          21720097, // https://etherscan.io/tx/0xb347305aab8233da8bd5be52e65b4d0467d94aa062055c99713fed6bdf6c4dfd#eventlog
          21720398, // https://etherscan.io/tx/0x89dc2dc60a66b0213b62b8f401f9b9e330d2dcce7e47fcf86f532a49c0867f92#eventlog
          21720451, // https://etherscan.io/tx/0x6a03f59a18763922d0bdfc05b9acdc74c3d6f5f525eda395c6e35ba845869c66#eventlog
          21727289, // https://etherscan.io/tx/0x24a6bb054064920551d36d32bb6cee9f6add4b1023600f729f032f7353e6d59f#eventlog
          21731500, // https://etherscan.io/tx/0x9576da1e7744612b05069278030a1ad522f254b3258767434ef48c8087d7b3bc#eventlog
          21731542, // https://etherscan.io/tx/0xf9edb3fb82ba6cb13dfb0dbfd12f25b88c7d0f725f39a0ffc5c755422d42a02f#eventlog
          21731547, // https://etherscan.io/tx/0x76836273f74e3e4181fd66b9a9ca3528842bc313aed6d3ec55e71891c456ff13#eventlog
          21731795, // https://etherscan.io/tx/0x9e0a0159dea55457626522e70977a001250cc2e497836386db14b0e3d5ac44cb#eventlog
          21731837, // https://etherscan.io/tx/0x7aba90f092b67a117682a38c1ea7b42d8d66b2ee4d255fc12c7ed99108e9f79a#eventlog
          21732396, // https://etherscan.io/tx/0x1d0feea3e60ac254f331e492907e73476d5d4fd5dc58e2bb39f07ea478455af5#eventlog
          21732624, // https://etherscan.io/tx/0x54039cbda8c389fa3c2f10c3d49457087331c5f1c4b1794da05ac4b0103a2f23#eventlog
          21732659, // https://etherscan.io/tx/0xe0d2ab7ebb56ed4992f7fda3d9ff478b1be5a5736f5a207439f985cd7134237a#eventlog
          21733044, // https://etherscan.io/tx/0x4f7e9f8e63e20d510d29fa7d525f1c2aad62166dc4d5801a1acb3d5c6ce41c42#eventlog
          21733064, // https://etherscan.io/tx/0x021c42c30c7aed4c9fff86936d7f609824cd3f78f2753ceec9f00ea932823ac6#eventlog
          21733215, // https://etherscan.io/tx/0x8b872bde647b7cf1ea20caf809546f59e97da6f457495c26aad3d5f014a35b19#eventlog
          21733424, // https://etherscan.io/tx/0xc2204573bff6bc3491b5ca6b045afc593ad477d21c9f5e601ab8c7b02c7e3118#eventlog
          21733612, // https://etherscan.io/tx/0x4cd00b47b56164b85ed9c477a5a3207e37c1c5fe78247252033bd6d2225dcfde#eventlog
          21733883, // https://etherscan.io/tx/0x2c7989d0276bdc48d013357a997ba92454bab70e51625aee4335ded8280c7892#eventlog
          21733948, // https://etherscan.io/tx/0x259af0ef83e91d2dbf577aa0eb4f245ee4d3de1a54a918dbe63c5f10fb07059b#eventlog
          21733948, // https://etherscan.io/tx/0x259af0ef83e91d2dbf577aa0eb4f245ee4d3de1a54a918dbe63c5f10fb07059b#eventlog
          21734191, // https://etherscan.io/tx/0x50be3c119c6b71b05559b4a64c51dcf1f10428a8dbf71657662a7fd10b6511eb#eventlog
          21734200, // https://etherscan.io/tx/0xbe45ca7bcb29735d6cdb8b912a1177f523b3f94d682a6b28ca4aa24c22ae1fe9#eventlog
          21734369, // https://etherscan.io/tx/0x94a0415714dc4f9c95761ef0a45187eb39e11f93513c268e53432d2285c3d311#eventlog
          21734520, // https://etherscan.io/tx/0x0b1bf03f94eadb3e7861053ebd7459527cb65996520c21708e31d8dee07514ec#eventlog
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
              '0x4f88f7c99022eace4740c6898f59ce6a2e798a1e64ce54589720b7153eb224a7', // initial params from Initialize event https://etherscan.io/tx/0x4e63fcc0dd42a2b317e77d17e236cadf77464a08ccece33a354bd8648b5f7419#eventlog
              '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
              '500',
              '0x0000000000000000000000000000000000000000',
              1379171615076210458510263019585807n,
              '195303',
              '10',
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
