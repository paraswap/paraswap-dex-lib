import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

type Pairs = { name: string; sellAmount: string; buyAmount: string }[][];

function testForNetwork(
  network: Network,
  dexKey: string,
  pairs: Pairs,
  slippage?: number | undefined,
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
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
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
                undefined,
                undefined,
                undefined,
                slippage,
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
                undefined,
                undefined,
                undefined,
                slippage,
              );
            });
          });
        });
      });
    }),
  );
}

describe('Wombat E2E', () => {
  const dexKey = 'Wombat';

  describe('BSC', () => {
    const network = Network.BSC;

    const pairs: Pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '1000000000',
          buyAmount: '1000000000',
        },
        {
          name: 'USDT',
          sellAmount: '1000000000',
          buyAmount: '1000000000',
        },
      ],
      [
        {
          name: 'BNB',
          sellAmount: '1000000000000000000',
          buyAmount: '1000000000000000000',
        },
        {
          name: 'BNBx',
          sellAmount: '1000000000000000000',
          buyAmount: '1000000000000000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    const pairs: Pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
        {
          name: 'USDT',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
      ],
      [
        {
          name: 'ETH',
          sellAmount: '10000000000000000',
          buyAmount: '10000000000000000',
        },
        {
          name: 'wstETH',
          sellAmount: '10000000000000000',
          buyAmount: '10000000000000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });

  describe('Ethereum', () => {
    const network = Network.MAINNET;

    const pairs: Pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
        {
          name: 'USDT',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
      ],
      [
        {
          name: 'ETH',
          sellAmount: '1000000000000000000',
          buyAmount: '1000000000000000000',
        },
        {
          name: 'wstETH',
          sellAmount: '1000000000000000000',
          buyAmount: '1000000000000000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });

  describe('Avalanche', () => {
    const network = Network.AVALANCHE;

    const pairs: Pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '10000000',
          buyAmount: '10000000',
        },
        {
          name: 'USDT',
          sellAmount: '10000000',
          buyAmount: '10000000',
        },
      ],
      [
        {
          name: 'AVAX',
          sellAmount: '100000000000000000000',
          buyAmount: '100000000000000000000',
        },
        {
          name: 'sAVAX',
          sellAmount: '100000000000000000000',
          buyAmount: '100000000000000000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });

  describe('Base', () => {
    const network = Network.BASE;

    const pairs: Pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
        {
          name: 'USDbC',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    const pairs: Pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
        {
          name: 'USDT',
          sellAmount: '100000000',
          buyAmount: '100000000',
        },
      ],
    ];

    testForNetwork(network, dexKey, pairs);
  });
});
