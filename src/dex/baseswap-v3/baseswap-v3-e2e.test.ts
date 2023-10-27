import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

// function testForNetwork(
//   network: Network,
//   dexKey: string,
//   tokenASymbol: string,
//   tokenBSymbol: string,
//   tokenAAmount: string,
//   tokenBAmount: string,
//   nativeTokenAmount: string,
//   slippage?: number | undefined,
// ) {
//   const provider = new StaticJsonRpcProvider(
//     generateConfig(network).privateHttpProvider,
//     network,
//   );
//   const tokens = Tokens[network];
//   const holders = Holders[network];
//   const nativeTokenSymbol = NativeTokenSymbols[network];

//   const sideToContractMethods = new Map([
//     [
//       SwapSide.SELL,
//       [
//         ContractMethod.simpleSwap,
//         ContractMethod.multiSwap,
//         ContractMethod.megaSwap,
//         // ContractMethod.directUniV3Swap,
//       ],
//     ],
//     [
//       SwapSide.BUY,
//       [
//         ContractMethod.simpleBuy,
//         ContractMethod.buy,
//         // ContractMethod.directUniV3Buy,
//       ],
//     ],
//   ]);

//   describe(`${network}`, () => {
//     sideToContractMethods.forEach((contractMethods, side) =>
//       describe(`${side}`, () => {
//         contractMethods.forEach((contractMethod: ContractMethod) => {
//           describe(`${contractMethod}`, () => {
//             it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
//               await testE2E(
//                 tokens[nativeTokenSymbol],
//                 tokens[tokenASymbol],
//                 holders[nativeTokenSymbol],
//                 side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
//                 side,
//                 dexKey,
//                 contractMethod,
//                 network,
//                 provider,
//                 undefined,
//                 undefined,
//                 undefined,
//                 slippage,
//               );
//             });
//             it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
//               await testE2E(
//                 tokens[tokenASymbol],
//                 tokens[nativeTokenSymbol],
//                 holders[tokenASymbol],
//                 side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
//                 side,
//                 dexKey,
//                 contractMethod,
//                 network,
//                 provider,
//                 undefined,
//                 undefined,
//                 undefined,
//                 slippage,
//               );
//             });
//             it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
//               await testE2E(
//                 tokens[tokenASymbol],
//                 tokens[tokenBSymbol],
//                 holders[tokenASymbol],
//                 side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
//                 side,
//                 dexKey,
//                 contractMethod,
//                 network,
//                 provider,
//                 undefined,
//                 undefined,
//                 undefined,
//                 slippage,
//               );
//             });
//           });
//         });
//       }),
//     );
//   });
// }

describe('BasewapV3 E2E', () => {
  describe('BasewapV3', () => {
    const dexKey = 'basewapV3';

    describe('BaseswapV3 Base', () => {
      const network = Network.BASE;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'USDbC';
      const tokenBSymbol: string = 'WETH';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '1000000000'; // 1000
      const tokenBAmount: string = '1000000000000000000'; // 1
      const nativeTokenAmount = '1000000000000000000';

      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            ContractMethod.multiSwap,
            ContractMethod.megaSwap,
          ],
        ],
        [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
      ]);

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[nativeTokenSymbol],
                tokens[tokenASymbol],
                holders[nativeTokenSymbol],
                side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[nativeTokenSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenBSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[tokenBSymbol],
                tokens[tokenASymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[tokenBSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        }),
      );
    });
  });
});
