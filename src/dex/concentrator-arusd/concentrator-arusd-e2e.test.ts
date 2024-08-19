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
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];

  const sideToContractMethods = new Map([
    [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
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
          });
        });
      }),
    );
  });
}

describe('ConcentratorArusd E2E', () => {
  const dexKey = 'ConcentratorArusd';
  const network = Network.MAINNET;

  const pairs: { name: string; amount: string; skipBuy?: boolean }[][] = [
    [
      {
        name: 'rUSD',
        amount: '1000000000000000',
      },
      {
        name: 'arUSD',
        amount: '1000000000000000000',
      },
    ],
    [
      {
        name: 'arUSD',
        amount: '1000000000000000000',
      },
      {
        name: 'rUSD',
        amount: '1000000000000000000',
      },
    ],
  ];

  pairs.forEach(pair => {
    testForNetwork(
      network,
      dexKey,
      pair[0].name,
      pair[1].name,
      pair[0].amount,
      pair[1].amount,
    );
  });
});
