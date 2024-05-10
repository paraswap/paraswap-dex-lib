import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from './tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { ethers } from 'ethers';

jest.setTimeout(50 * 1000);

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

    const testData = [['USDC', 'USDT', 51000, 51000, 17]];
    const testBlock = 19831195;

    const sideToContractMethods = {
      [SwapSide.SELL]: ContractMethod.simpleSwap,
      [SwapSide.BUY]: ContractMethod.simpleBuy,
    };

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
          tokens[tokenASymbol],
          tokens[nativeTokenSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          SwapSide.SELL,
          dexKey,
          sideToContractMethods[SwapSide.SELL],
          network,
          provider,
          testBlock,
        );
      });
      it(`${tokenASymbol} -> ` + nativeTokenSymbol, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[nativeTokenSymbol],
          holders[tokenASymbol],
          nativeTokenAmount,
          SwapSide.BUY,
          dexKey,
          sideToContractMethods[SwapSide.BUY],
          network,
          provider,
          testBlock,
        );
      });
      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          SwapSide.SELL,
          dexKey,
          sideToContractMethods[SwapSide.SELL],
          network,
          provider,
          testBlock,
        );
      });
      it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          SwapSide.BUY,
          dexKey,
          sideToContractMethods[SwapSide.BUY],
          network,
          provider,
          testBlock,
        );
      });
    }
  });
});
