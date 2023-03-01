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
import { ethers } from 'ethers';

describe('Integral E2E', () => {
  const dexKey = 'Integral';

  describe('Integral MAINNET', () => {
    const network = Network.MAINNET;

    const tokens = Tokens[network];

    const holders = Holders[network];

    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const nativeTokenSymbol = NativeTokenSymbols[network];

    const testData = [
      ['USDC', 'WETH', 180, 0.1, 0.1],
    ];

    const sideToContractMethods = new Map([
      [SwapSide.SELL, [ContractMethod.simpleSwap]],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          for (const [
            tokenASymbol,
            tokenBSymbol,
            valueA,
            valueB,
            valueNative,
          ] of testData) {
            const tokenA = tokens[tokenASymbol];
            const tokenB = tokens[tokenBSymbol];
            const tokenAAmount = ethers.utils
              .parseUnits(valueA.toString(), tokenA.decimals)
              .toString();
            const tokenBAmount = ethers.utils
              .parseUnits(valueB.toString(), tokenB.decimals)
              .toString();
            const nativeTokenAmount = ethers.utils
              .parseUnits(valueNative.toString(), 18)
              .toString();
            it(nativeTokenSymbol + ` -> ${tokenASymbol}`, async () => {
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
            it(`${tokenASymbol} -> ` + nativeTokenSymbol, async () => {
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
            it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
          }
        });
      }),
    );
  });
});
