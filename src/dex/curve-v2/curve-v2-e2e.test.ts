import dotenv from 'dotenv';
dotenv.config();

import { Holders, Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { DIRECT_METHOD_NAME_V6 } from './constants';
import { testE2E } from '../../../tests/utils-e2e';

// Ensure you have the E2E_ENDPOINT_URL env variable set.

describe('CurveV2 E2E', () => {
  const dexKey = 'CurveV2';

  describe('CurveV2_MAINNET_v6', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];

    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokensToTest = [
      [
        {
          symbol: 'USDC',
          amount: (10 ** 8).toString(),
        },
        {
          symbol: 'USDT',
          amount: (10 ** 8).toString(),
        },
      ],
    ];

    const sideToContractMethods = new Map([
      [SwapSide.SELL, [DIRECT_METHOD_NAME_V6]],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: string) => {
        tokensToTest.forEach(pair => {
          describe(`${contractMethod}`, () => {
            it(`${pair[0].symbol} -> ${pair[1].symbol}`, async () => {
              await testE2E(
                tokens[pair[0].symbol],
                tokens[pair[1].symbol],
                holders[pair[0].symbol],
                side === SwapSide.SELL ? pair[0].amount : pair[1].amount,
                side,
                dexKey,
                contractMethod as any,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });
});
