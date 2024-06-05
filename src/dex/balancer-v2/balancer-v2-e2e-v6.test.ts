import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Holders,
  Tokens,
} from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

import { generateConfig } from '../../config';

jest.setTimeout(50 * 1000);

describe('BalancerV2 E2E V6', () => {
  describe('BalancerV2', () => {
    const dexKey = 'BalancerV2';
    const network = Network.POLYGON;
    const tokens = Tokens[Network.POLYGON];
    const holders = Holders[Network.POLYGON];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.swapExactAmountIn,
          // ContractMethod.swapExactAmountInOnBalancerV2,
        ],
      ],
      [
        SwapSide.BUY,
        [
          ContractMethod.swapExactAmountOut,
          // ContractMethod.swapExactAmountOutOnBalancerV2,
        ],
      ],
    ]);

    const pairs: { name: string; sellAmount: string }[][] = [
      [
        { name: 'WMATIC', sellAmount: '1000000000000000000' },
        { name: 'stMATIC', sellAmount: '1000000000000000000' },
      ],
      [
        { name: 'MATIC', sellAmount: '1000000000000000000' },
        { name: 'stMATIC', sellAmount: '1000000000000000000' },
      ],
    ];

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
                  pair[0].sellAmount,
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
                  pair[1].sellAmount,
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
  });
});
