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
                undefined,
                undefined,
                undefined,
                1,
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
                undefined,
                undefined,
                undefined,
                1,
              );
            });
          });
        });
      }),
    );
  });
}

describe('AngleStakedStable E2E', () => {
  const networksEUR = [
    Network.MAINNET,
    Network.ARBITRUM,
    Network.POLYGON,
    Network.OPTIMISM,
  ];

  const networksUSD = [
    Network.MAINNET,
    Network.ARBITRUM,
    Network.POLYGON,
    Network.OPTIMISM,
    Network.BASE,
    Network.BSC,
  ];

  networksEUR.forEach(network =>
    describe(`${network} - EUR`, () => {
      const dexKey = 'AngleStakedStableEUR';
      const tokenASymbol: string = 'EURA';
      const tokenBSymbol: string = 'stEUR';
      const tokenAAmount: string = '990000000000000000';
      const tokenBAmount: string = '990000000000000000';
      const nativeTokenAmount = '990000000000000000';
      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    }),
  );

  networksUSD.forEach(network =>
    describe(`${network} - USD`, () => {
      const dexKey = 'AngleStakedStableUSD';
      const tokenASymbol: string = 'USDA';
      const tokenBSymbol: string = 'stUSD';
      const tokenAAmount: string = '990000000000000000';
      const tokenBAmount: string = '990000000000000000';
      const nativeTokenAmount = '990000000000000000';
      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    }),
  );
});
