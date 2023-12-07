/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {
  Holders,
  NativeTokenSymbols,
  Tokens,
} from '../../../tests/constants-e2e';
import { generateConfig } from '../../config';
import { ContractMethod, Network, SwapSide } from '../../constants';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];
  const nativeTokenSymbol = NativeTokenSymbols[network];

  // TODO: Add any direct swap contractMethod name if it exists
  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
    // TODO: If buy is not supported remove the buy contract methods
    [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {});
          });
        });
      }),
    );
  });
}

describe('Claystack E2E', () => {
  const dexKey = 'Claystack';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    // TODO: Modify the tokenASymbol, tokenBSymbol, tokenAAmount;
    const tokenASymbol: string = 'ETH';
    const tokenBSymbol: string = 'csETH';

    const tokenAAmount: string = '100';
    const tokenBAmount: string = '100';
    const nativeTokenAmount = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
    );
  });
});
