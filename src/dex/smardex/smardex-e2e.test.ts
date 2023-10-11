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
    [
      SwapSide.BUY,
      [
        ContractMethod.simpleBuy,
        // ContractMethod.buy,
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
                side === SwapSide.SELL
                  ? pair[0].sellAmount
                  : pair[0].buyAmount,
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
                side === SwapSide.SELL
                  ? pair[1].sellAmount
                  : pair[1].buyAmount,
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

describe('SmarDex E2E', () => {
  const dexKey = 'SmarDex';

  describe('MAINNET', () => {
    const network = Network.MAINNET;

    const pairs = [
      [
        {
          name: 'USDT',
          sellAmount: '1200000000',
          buyAmount: '120000',
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000',
          buyAmount: '30000000000',
        },
      ],
      [
        {
          name: 'USDT',
          sellAmount: '1200000000',
          buyAmount: '1200000000',
        },
        {
          name: 'ETH',
          sellAmount: '11000000000000000',
          buyAmount: '1100000000',
        },
      ],
    ];

    testForNetwork(
      network,
      dexKey,
      pairs,
    );
  });

  describe('ARBITRUM', () => {
    const network = Network.ARBITRUM;

    const pairs = [
      [
        {
          name: 'USDC',
          sellAmount: '1200000000',
          buyAmount: '120000',
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000',
          buyAmount: '30000000000',
        },
      ],
      [
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000',
          buyAmount: '11000000000000000',
        },
        {
          name: 'ETH',
          sellAmount: '11000000000000000',
          buyAmount: '11000000',
        },
      ],
    ];

    testForNetwork(
      network,
      dexKey,
      pairs
    );
  });

  describe('BSC', () => {
    const network = Network.BSC;

    const pairs = [
      [
        {
          name: 'USDT',
          sellAmount: '1200000000000000000000',
          buyAmount: '300000000000000000000000',
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000',
          buyAmount: '120000000000000000000',
        },
      ],
      [
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000',
          buyAmount: '50000000000000000',
        },
        {
          name: 'bBTC',
          sellAmount: '50000000000000000',
          buyAmount: '300000000000000000000000',
        },
      ],
      [
        {
          name: 'USDT',
          sellAmount: '1500000000000000000000',
          buyAmount: '20000000000000000000',
        },
        {
          name: 'BNB',
          sellAmount: '20000000000000000000',
          buyAmount: '1500000000000000000000',
        },
      ],
    ];

    testForNetwork(
      network,
      dexKey,
      pairs
    );
  });

  describe('POLYGON', () => {
    const network = Network.POLYGON;

    const pairs = [
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000',
          buyAmount: '250000000000000000000000',
        },
        {
          name: 'SDEX',
          sellAmount: '250000000000000000000000',
          buyAmount: '1500000000000000000',
        },
      ],
      [
        {
          name: 'USDC',
          sellAmount: '2500000000',
          buyAmount: '300000000000000000000000',
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000',
          buyAmount: '2500000000',
        },
      ],
      [
        {
          name: 'USDC',
          sellAmount: '2500000000',
          buyAmount: '8000000000000000000000',
        },
        {
          name: 'MATIC',
          sellAmount: '8000000000000000000000',
          buyAmount: '2500000000',
        },
      ],
      [
        {
          name: 'SDEX',
          sellAmount: '190000000000000000000000',
          buyAmount: '8000000',
        },
        {
          name: 'WBTC',
          sellAmount: '8000000',
          buyAmount: '190000000000000000000000',
        },
      ],
    ];

    testForNetwork(
      network,
      dexKey,
      pairs,
    );
  });

  describe('BASE', () => {
    const network = Network.BASE;

    const pairs = [
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000',
          buyAmount: '2500000000',
        },
        {
          name: 'USDbC',
          sellAmount: '2500000000',
          buyAmount: '1500000000000000000',
        },
      ],
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000',
          buyAmount: '250000000000000000000000',
        },
        {
          name: 'SDEX',
          sellAmount: '250000000000000000000000',
          buyAmount: '1500000000000000000',
        },
      ],
    ];

    testForNetwork(
      network,
      dexKey,
      pairs,
    );
  });
});
