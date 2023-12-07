/* eslint-disable no-console */
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
import { parseUnits } from 'ethers/lib/utils';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];

  // TODO: Add any direct swap contractMethod name if it exists
  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
      ],
    ],
    [
      SwapSide.BUY,
      [
        ContractMethod.simpleBuy,
        // ContractMethod.buy
      ],
    ],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
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
            it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[tokenBSymbol],
                tokens[tokenASymbol],
                holders[tokenBSymbol],
                side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });
}

describe('LighterV2 E2E', () => {
  const dexKey = 'LighterV2';

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const native: string = NativeTokenSymbols[network];
    const weth: string = 'WETH';
    const usdc: string = 'USDCe';

    const wethAmount: string = parseUnits('1.0', 18).toString();
    const usdcAmount: string = parseUnits('1900.0', 6).toString();

    // WETH <-> USDC.e
    testForNetwork(network, dexKey, weth, usdc, wethAmount, usdcAmount);

    // ETH <-> USDC.e
    testForNetwork(network, dexKey, native, usdc, wethAmount, usdcAmount);
  });
});
