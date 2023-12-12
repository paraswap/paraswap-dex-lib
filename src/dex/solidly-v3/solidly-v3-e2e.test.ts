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
  pairs: { name: string; sellAmount: string; buyAmount: string }[][],
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];

  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
      ],
    ],
    [SwapSide.BUY, [ContractMethod.simpleBuy /*, ContractMethod.buy */]],
  ]);

  sideToContractMethods.forEach((contractMethods, side) =>
    describe(`${side}`, () => {
      contractMethods.forEach((contractMethod: ContractMethod) => {
        pairs.forEach(pair => {
          describe(`${contractMethod}`, () => {
            it(`${pair[0].name} -> ${pair[1].name}`, async () => {
              await testE2E(
                tokens[pair[0].name],
                tokens[pair[1].name],
                holders[pair[0].name],
                side === SwapSide.SELL ? pair[0].sellAmount : pair[0].buyAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${pair[1].name} -> ${pair[0].name}`, async () => {
              await testE2E(
                tokens[pair[1].name],
                tokens[pair[0].name],
                holders[pair[1].name],
                side === SwapSide.SELL ? pair[1].sellAmount : pair[1].buyAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      });
    }),
  );
}

describe('SolidlyV3 E2E', () => {
  const dexKey = 'SolidlyV3';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    const pairs = [
      [
        {
          name: 'WETH',
          sellAmount: '1100000000000000000',
          buyAmount: '1100000000',
        },
        {
          name: 'USDC',
          sellAmount: '400000000',
          buyAmount: '4000000',
        },
      ],
      [
        {
          name: 'USDC',
          sellAmount: '400000000',
          buyAmount: '4000000',
        },
        {
          name: 'USDT',
          sellAmount: '500000000',
          buyAmount: '5000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });
});
