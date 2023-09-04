// import _ from 'lodash';
// import { balancerV2Merge, AllBalancerV2Forks } from './optimizer';
// import { UnoptimizedRate } from '../../types';
// import { SwapSide } from '@paraswap/core';
//
// describe('BalancerV2 optimizer', () => {
// These values are random and are not important. The only invariant here we need to make sure,
// that the optimizer does not change these values
//   const baseUnoptimizedRate: UnoptimizedRate = {
//     blockNumber: 99,
//     network: 1,
//     srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//     srcDecimals: 18,
//     srcAmount: '1',
//     destToken: '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//     destDecimals: 18,
//     destAmount: '2',
//     gasCostUSD: '12.178524',
//     gasCost: '747300',
//     side: SwapSide.SELL,
//     tokenTransferProxy: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
//     contractAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
//     bestRoute: [],
//   };
//   it('balancerV2Merge swapExchanges: BalancerV2-BalancerV2Fork', () => {
//     const testRate: UnoptimizedRate = _.cloneDeep(baseUnoptimizedRate);
//     testRate.bestRoute = [
//       {
//         percent: 92,
//         swaps: [
//           {
//             srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//             srcDecimals: 18,
//             destToken: '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//             destDecimals: 18,
//             swapExchanges: [
//               {
//                 exchange: 'BalancerV2',
//                 srcAmount: '27001080000000000000',
//                 destAmount: '1663710383246524230443584',
//                 percent: 97.83,
//                 poolAddresses: ['0xcb0e14e96f2cefa8550ad8e4aea344f211e5061d'],
//                 data: {
//                   poolId:
//                     '0xcb0e14e96f2cefa8550ad8e4aea344f211e5061d00020000000000000000011a',
//                   gasUSD: '2.395615',
//                 },
//               },
//               {
//                 exchange: 'BeetsFi',
//                 srcAmount: '598920000000000000',
//                 destAmount: '36257151080030344235259',
//                 percent: 2.17,
//                 poolAddresses: ['0x458ae80894A0924Ac763C034977e330c565F1687'],
//                 data: {
//                   poolId:
//                     '0x87a867f5d240a782d43d90b6b06dea470f3f8f22000200000000000000000516',
//                   gasUSD: '2.395615',
//                 },
//               },
//             ],
//           },
//         ],
//       },
//       {
//         percent: 8,
//         swaps: [
//           {
//             srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//             srcDecimals: 18,
//             destToken: '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//             destDecimals: 18,
//             swapExchanges: [
//               {
//                 exchange: 'Bancor',
//                 srcAmount: '2400000000000000000',
//                 destAmount: '9235411862479221870019',
//                 percent: 100,
//                 poolAddresses: ['0x4c9a2bD661D640dA3634A4988a9Bd2Bc0f18e5a9'],
//                 data: {
//                   path: [
//                     '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//                     '0xb1CD6e4153B2a390Cf00A6556b0fC1458C4A5533',
//                     '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//                   ],
//                   gasUSD: '3.259340',
//                 },
//               },
//             ],
//           },
//           {
//             srcToken: '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//             srcDecimals: 18,
//             destToken: '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//             destDecimals: 18,
//             swapExchanges: [
//               {
//                 exchange: 'Bancor',
//                 srcAmount: '9235411862479221870019',
//                 destAmount: '144326625204595711989170',
//                 percent: 100,
//                 poolAddresses: ['0xe950137942F446a93C8309B3a7c1407ef1975856'],
//                 data: {
//                   path: [
//                     '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//                     '0xdD17F899D4Fa66249bfdba45F0c70817052559Ac',
//                     '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//                   ],
//                   gasUSD: '3.259340',
//                 },
//               },
//             ],
//           },
//         ],
//       },
//     ];
//
//     const optimizedRate = balancerV2Merge(testRate);
//
//     const expectedRate: UnoptimizedRate = _.cloneDeep(baseUnoptimizedRate);
//     expectedRate.bestRoute = [
//       {
//         percent: 92,
//         swaps: [
//           {
//             srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//             srcDecimals: 18,
//             destToken: '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//             destDecimals: 18,
//             swapExchanges: [
//               {
//                 exchange: 'BalancerV2',
//                 srcAmount: '27001080000000000000',
//                 destAmount: '1663710383246524230443584',
//                 percent: 97.83,
//                 poolAddresses: ['0xcb0e14e96f2cefa8550ad8e4aea344f211e5061d'],
//                 data: {
//                   poolId:
//                     '0xcb0e14e96f2cefa8550ad8e4aea344f211e5061d00020000000000000000011a',
//                   gasUSD: '2.395615',
//                 },
//               },
//               {
//                 exchange: 'BeetsFi',
//                 srcAmount: '598920000000000000',
//                 destAmount: '36257151080030344235259',
//                 percent: 2.17,
//                 poolAddresses: ['0x458ae80894A0924Ac763C034977e330c565F1687'],
//                 data: {
//                   poolId:
//                     '0x87a867f5d240a782d43d90b6b06dea470f3f8f22000200000000000000000516',
//                   gasUSD: '2.395615',
//                 },
//               },
//             ],
//           },
//         ],
//       },
//       {
//         percent: 8,
//         swaps: [
//           {
//             srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//             srcDecimals: 18,
//             destToken: '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//             destDecimals: 18,
//             swapExchanges: [
//               {
//                 exchange: 'Bancor',
//                 srcAmount: '2400000000000000000',
//                 destAmount: '9235411862479221870019',
//                 percent: 100,
//                 poolAddresses: ['0x4c9a2bD661D640dA3634A4988a9Bd2Bc0f18e5a9'],
//                 data: {
//                   path: [
//                     '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//                     '0xb1CD6e4153B2a390Cf00A6556b0fC1458C4A5533',
//                     '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//                   ],
//                   gasUSD: '3.259340',
//                 },
//               },
//             ],
//           },
//           {
//             srcToken: '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//             srcDecimals: 18,
//             destToken: '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//             destDecimals: 18,
//             swapExchanges: [
//               {
//                 exchange: 'Bancor',
//                 srcAmount: '9235411862479221870019',
//                 destAmount: '144326625204595711989170',
//                 percent: 100,
//                 poolAddresses: ['0xe950137942F446a93C8309B3a7c1407ef1975856'],
//                 data: {
//                   path: [
//                     '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
//                     '0xdD17F899D4Fa66249bfdba45F0c70817052559Ac',
//                     '0xcafe001067cdef266afb7eb5a286dcfd277f3de5',
//                   ],
//                   gasUSD: '3.259340',
//                 },
//               },
//             ],
//           },
//         ],
//       },
//     ];
//
//     expect(optimizedRate).toStrictEqual(expectedRate);
//   });
//
//   it('balancerV2Merge swapExchanges: No BalancerV2', () => {
//     expect(true).toBe(true);
//   });
//
//   it('balancerV2Merge swaps: BalancerV2-BalancerV2Fork', () => {
//     expect(true).toBe(true);
//   });
//
//   it('balancerV2Merge only one BalancerV2Fork in route', () => {
//     expect(true).toBe(true);
//   });
// });
