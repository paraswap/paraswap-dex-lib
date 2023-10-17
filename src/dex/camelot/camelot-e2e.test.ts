import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Camelot E2E', () => {
  describe('Camelot', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const dexKey = 'Camelot';

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    const pairs: { name: string; sellAmount: string }[][] = [
      [
        { name: 'ETH', sellAmount: '700000000000' },
        { name: 'USDC', sellAmount: '1000000' },
      ],
      [
        { name: 'ETH', sellAmount: '700000000000' },
        { name: 'USDT', sellAmount: '1000000' },
      ],
      [
        { name: 'USDC', sellAmount: '100000000' },
        { name: 'WETH', sellAmount: '200000000000' },
      ],
      [
        { name: 'USDC', sellAmount: '100000' },
        { name: 'DAI', sellAmount: '200000000000000' },
      ],
      [
        { name: 'USDC', sellAmount: '100000' },
        { name: 'USDT', sellAmount: '100000' },
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
