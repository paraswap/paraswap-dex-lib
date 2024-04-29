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
      SwapSide.BUY,
      [
        ContractMethod.simpleBuy,
        // ContractMethod.buy
      ],
    ],
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
      ],
    ],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${tokenASymbol} -> ${tokenBSymbol} - ${
              side === SwapSide.SELL ? tokenAAmount : tokenBAmount
            }`, async () => {
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

            it(`${tokenBSymbol} -> ${tokenASymbol} - ${
              side === SwapSide.SELL ? tokenBAmount : tokenAAmount
            }`, async () => {
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

describe('IdleDao E2E', () => {
  const dexKey = 'IdleDao';

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const tests = [
      {
        tokenASymbol: 'STETH',
        tokenBSymbol: 'AA_wstETH',
        tokenAAmount: '1000000000000000000',
        tokenBAmount: '1000000000000000000',
      },
      {
        tokenASymbol: 'USDC',
        tokenBSymbol: 'AA_idle_cpPOR-USDC',
        tokenAAmount: '1000000',
        tokenBAmount: '1000000000000000000',
      },
      {
        tokenASymbol: 'USDT',
        tokenBSymbol: 'BB_idle_cpFAS-USDT',
        tokenAAmount: '1000000',
        tokenBAmount: '1000000000000000000',
      },
      {
        tokenASymbol: 'WETH',
        tokenBSymbol: 'BB_Re7WETH',
        tokenAAmount: '100000000000000',
        tokenBAmount: '100000000000000',
      },
      {
        tokenASymbol: 'WETH',
        tokenBSymbol: 'AA_Re7WETH',
        tokenAAmount: '1000000000000000',
        tokenBAmount: '1000000000000000',
      },
      {
        tokenASymbol: 'STETH',
        tokenBSymbol: 'AA_iETHv2',
        tokenAAmount: '1000000000000000',
        tokenBAmount: '1000000000000000',
      },
      {
        tokenASymbol: 'STETH',
        tokenBSymbol: 'BB_iETHv2',
        tokenAAmount: '1000000000000000',
        tokenBAmount: '1000000000000000',
      },
    ];

    tests.forEach(testData => {
      testForNetwork(
        network,
        dexKey,
        testData.tokenASymbol,
        testData.tokenBSymbol,
        testData.tokenAAmount,
        testData.tokenBAmount,
      );
    });
  });
});
