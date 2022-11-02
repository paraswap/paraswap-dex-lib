/*
 * It is just blind copy paste from API event tests. I will delete from API
 * And here it must be adapted to work properly
 */

// import '../../src/lib/log4js';
// import dotenv from 'dotenv';
// dotenv.config();

// import { ThreePool } from '../../src/lib/connectors/curve/3pool';
// import { SUSDPool } from '../../src/lib/connectors/curve/sUSDpool';
// import { HBTCPool } from '../../src/lib/connectors/curve/hBTCpool';
// import { RenPool } from '../../src/lib/connectors/curve/renpool';
// import { SBTCPool } from '../../src/lib/connectors/curve/sBTCpool';
// import { SwervePool } from '../../src/lib/connectors/curve/swerve';
// import { SETHPool } from '../../src/lib/connectors/curve/sETHpool';
// import { STETHPool } from '../../src/lib/connectors/curve/stETHpool';
// import { EURSPool } from '../../src/lib/connectors/curve/EURSpool';
// import { DUSDPool } from '../../src/lib/connectors/curve/DUSDpool';
// import { providerManager } from '../../src/lib/web3-provider';
// import { getManyPoolStates } from '../../src/lib/connectors/curve/getstate-multicall';
// import multiABI from '../../src/lib/abi/multi.abi.json';
// import StableSwapEURS from '../../src/lib/abi/curve-v1/StableSwapEURS.json';
// import { StaticJsonRpcProvider } from '@ethersproject/providers';
// import { doTest } from './utils';
// import { MULTI } from '../../src/constants';
// import { AbiItem } from 'web3-utils';

// const network = 1;
// const web3Provider = providerManager.getProvider(network);

// describe('Get pool states', function () {
//   jest.setTimeout(30000);
//   it('Should get same pool state using multicall for many pools', async function () {
//     const blockNumber = 11277689;
//     const threePool = new ThreePool('curve', web3Provider, network);
//     const sUSDPool = new SUSDPool('curve', web3Provider, network);
//     const multi = new web3Provider.eth.Contract(
//       multiABI as AbiItem[],
//       MULTI[1],
//     );
//     const states = await getManyPoolStates(
//       [threePool, sUSDPool],
//       multi,
//       blockNumber,
//     );
//     expect(states[0]).toEqual(
//       await threePool.generateState(blockNumber, false),
//     );
//     expect(states[1]).toEqual(await sUSDPool.generateState(blockNumber, false));
//   });

//   it('Should get same pool state using multicall for one pool', async function () {
//     const blockNumber = 11277689;
//     const threePool = new ThreePool('curve', web3Provider, network);
//     expect(await threePool.generateState(blockNumber)).toEqual(
//       await threePool.generateState(blockNumber, false),
//     );
//   });

//   it('Should get same pool state using multicall for normal pools with meta pools', async function () {
//     const blockNumber = 11277689;
//     const threePool = new ThreePool('curve', web3Provider, network);
//     const sUSDPool = new SUSDPool('curve', web3Provider, network);
//     const dUSDPool = new DUSDPool('curve', web3Provider, network);
//     const multi = new web3Provider.eth.Contract(
//       multiABI as AbiItem[],
//       MULTI[1],
//     );
//     const states = await getManyPoolStates(
//       [threePool, sUSDPool, dUSDPool],
//       multi,
//       blockNumber,
//     );
//     expect(states[0]).toEqual(
//       await threePool.generateState(blockNumber, false),
//     );
//     expect(states[1]).toEqual(await sUSDPool.generateState(blockNumber, false));
//     expect(states[2]).toEqual(await dUSDPool.generateState(blockNumber, false));
//   });
// });

// describe('3pool', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [11277689, 11287268],
//     RemoveLiquidityOne: [11284852, 11287261, 11325636, 11323309],
//     TokenExchange: [11287267, 11284828],
//     RemoveLiquidity: [11289857, 11287370],
//     RemoveLiquidityImbalance: [11289954, 11290456],
//     TokenExchangeUnderlying: [],
//     CommitNewFee: [10923677],
//     NewFee: [10947641],
//     RampA: [11068962],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new ThreePool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, '3pool', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('sUSD pool', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [11319142, 11318357],
//     TokenExchange: [11317217, 11317208],
//     TokenExchangeUnderlying: [11319999, 11319994],
//     RemoveLiquidity: [11318768, 11287370],
//     RemoveLiquidityImbalance: [11318090],
//     CommitNewParameters: [10082431, 10875110],
//     NewParameters: [10105739, 10895154],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new SUSDPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'sUSD', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('hBTC', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [11333456, 11333991],
//     RemoveLiquidityOne: [11333441, 11333580],
//     TokenExchange: [11333680, 11333993],
//     RemoveLiquidity: [10732661, 10732822],
//     RemoveLiquidityImbalance: [10732676, 10830904],
//     CommitNewFee: [10875110],
//     NewFee: [10895154],
//     RampA: [10952241],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new HBTCPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'hBTC', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('ren', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [
//       11339710, 11339795, 11339951, 11340120, 11340331, 11340456, 11340491,
//     ],
//     RemoveLiquidityOne: [11339700, 11340108, 11340155, 11340173],
//     TokenExchange: [
//       11339583, 11340064, 11340116, 11340238, 11340289, 11340438, 11340482,
//     ],
//     RemoveLiquidity: [10191766, 10197133, 10199132],
//     RemoveLiquidityImbalance: [10193304, 10197807, 10198966],
//     CommitNewFee: [10875110],
//     NewFee: [10895154],
//     RampA: [10950815, 11087676],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new RenPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'ren', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('sBTC', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [11345467, 11345573, 11345633, 11345839, 11345865],
//     RemoveLiquidityOne: [11345273, 11345273],
//     TokenExchange: [11345689, 11346118, 11346133],
//     RemoveLiquidity: [10277309, 10292385, 10293330, 10302937],
//     RemoveLiquidityImbalance: [10277313, 10292456, 10292869, 10293347],
//     CommitNewFee: [10875110],
//     NewFee: [10895154],
//     RampA: [],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new SBTCPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'sBTC', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('swerve', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [11317422, 11319605, 11319636, 11324023],
//     TokenExchange: [11345746, 11345796, 11345820, 11345823, 11345828, 11345917],
//     TokenExchangeUnderlying: [11345921, 11346051],
//     RemoveLiquidity: [10794266, 10798918, 10799196],
//     RemoveLiquidityImbalance: [10794276, 10798836, 10798858, 10798863],
//     CommitNewParameters: [10873942, 10976756],
//     NewParameters: [10893484, 11179557],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new SwervePool('swerve', web3Provider, network);
//           await doTest(pool, blockNumber, 'swerve', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('sETH', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [
//       11492059, 11492411, 11492502, 11492554, 11492620, 11492693, 11492774,
//       11492828, 11492856, 11492906,
//     ],
//     RemoveLiquidityOne: [
//       11528360, 11528505, 11529314, 11530496, 11531203, 11531916, 11537024,
//       11546850,
//     ],
//     TokenExchange: [
//       11491955, 11492019, 11492089, 11492714, 11493319, 11494480, 11494545,
//       11496976, 11496992, 11497384,
//     ],
//     RemoveLiquidity: [11501188, 11503665, 11505538, 11529130],
//     RemoveLiquidityImbalance: [11515519, 11544104, 11544163, 11545463],
//     CommitNewFee: [],
//     NewFee: [],
//     RampA: [],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new SETHPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'sETHpool', web3Provider);
//         });
//       });
//     });
//   });
// });

// describe('stETH', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [
//       11595201, 11595375, 11595437, 11595464, 11595622, 11595721, 11595874,
//       11595930,
//     ],
//     RemoveLiquidityOne: [
//       11595786, 11595955, 11598604, 11600957, 11608259, 11612984,
//     ],
//     TokenExchange: [
//       11597228, 11597392, 11597726, 11598365, 11598633, 11598705, 11599546,
//       11599631,
//     ],
//     RemoveLiquidity: [11596894],
//     RemoveLiquidityImbalance: [],
//     CommitNewFee: [],
//     NewFee: [],
//     RampA: [],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new STETHPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'STETHPool', web3Provider, true);
//         });
//       });
//     });
//   });
// });

// describe('EURS', function () {
//   const blockNumbers: { [event: string]: number[] } = {
//     AddLiquidity: [
//       11489991, 11491321, 11491634, 11493475, 11500387, 11513189, 11513326,
//       11513365,
//     ],
//     RemoveLiquidityOne: [
//       11570934, 11571268, 11571731, 11574303, 11583795, 11584364, 11590646,
//       11592345,
//     ],
//     TokenExchange: [
//       11514562, 11516293, 11516836, 11516851, 11518846, 11519336, 11522051,
//       11522262,
//     ],
//     RemoveLiquidity: [11524017, 11589766, 11591462, 11602816],
//     RemoveLiquidityImbalance: [
//       11579909, 11581510, 11638078, 11642524, 11644774, 11645808,
//     ],
//     CommitNewFee: [],
//     NewFee: [],
//     RampA: [],
//     StopRampA: [],
//   };

//   describe('events', function () {
//     Object.keys(blockNumbers).forEach((event: string) => {
//       blockNumbers[event].forEach((blockNumber: number) => {
//         it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
//           const pool = new EURSPool('curve', web3Provider, network);
//           await doTest(pool, blockNumber, 'EURSPool', web3Provider);
//         });
//       });
//     });
//   });
// });
