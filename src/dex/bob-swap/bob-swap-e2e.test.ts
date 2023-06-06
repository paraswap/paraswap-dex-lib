/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  bobTokenAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];
  const bobTokenSymbol = 'BOB';

  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
      ],
    ],
    // [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${bobTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[bobTokenSymbol],
                tokens[tokenASymbol],
                holders[bobTokenSymbol],
                side === SwapSide.SELL ? bobTokenAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenASymbol} -> ${bobTokenSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[bobTokenSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : bobTokenAmount,
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
          });
        });
      }),
    );
  });
}

describe('BobSwap E2E', () => {
  const dexKey = 'BobSwap';
  const tokenASymbol: string = 'USDC';
  const tokenBSymbol: string = 'USDT';
  let tokenAAmount: string = '100000000';
  let tokenBAmount: string = '100000000';
  const bobTokenAmount = '1000000000000000000000';

  describe('Polygon', () => {
    const network = Network.POLYGON;
    // Low balance of USDT on Polygon. Swap will be unsuccessful
    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      '100000',
      '100000',
      bobTokenAmount,
    );
  });

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      bobTokenAmount,
    );
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      bobTokenAmount,
    );
  });

  describe('Binance Smart Chain', () => {
    const network = Network.BSC;

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      bobTokenAmount,
    );
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      bobTokenAmount,
    );
  });
});
