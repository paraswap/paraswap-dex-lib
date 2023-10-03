import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

interface SmardexE2ePairToken {
  name: string;
  sellAmount: string;
  buyAmount: string;
}
type SmardexE2ePair = SmardexE2ePairToken[];

describe('Smardex E2E', () => {
  // Generate pairs for each network twice: each time with small and big swap amount (x10)
  const allPairs: { [key: number]: SmardexE2ePair[] } = {
    [Network.MAINNET]: [
      [
        {
          name: 'ETH',
          sellAmount: '2000000000000000000', // 2 ETH
          buyAmount: '300000000000000000000000', // 300K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000', // 300K SDEX
          buyAmount: '2000000000000000000', // 2 ETH
        },
      ],
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000', // 1.5 WETH
          buyAmount: '250000000000000000000000', // 250K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '250000000000000000000000', // 250K SDEX
          buyAmount: '1500000000000000000', // 1.5 WETH
        },
      ],
      [
        {
          name: 'USDT',
          sellAmount: '1200000000', // 1200 USDT
          buyAmount: '300000000000000000000000', // 300K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000', // 300K SDEX
          buyAmount: '1200000000', // 1200 USDT
        },
      ],
      [
        {
          name: 'WBTC',
          sellAmount: '30000000', // 0.3 WBTC
          buyAmount: '2500000000000000000', // 2.5 WETH
        },
        {
          name: 'WETH',
          sellAmount: '2500000000000000000', // 2.5 WETH
          buyAmount: '30000000', // 0.3 WBTC
        },
      ],
    ]
      .map((pair, i, arr) => [
        [pair],
        [
          arr[i].map(token => ({
            ...token,
            sellAmount: token.sellAmount + '0',
            buyAmount: token.buyAmount + '0',
          })),
        ],
      ])
      .flat(2),
    [Network.ARBITRUM]: [
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000', // 1.5 WETH
          buyAmount: '250000000000000000000000', // 250K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '250000000000000000000000', // 250K SDEX
          buyAmount: '1500000000000000000', // 1.5 WETH
        },
      ],
      [
        {
          name: 'USDC',
          sellAmount: '1200000000', // 1200 USDC
          buyAmount: '300000000000000000000000', // 300K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000', // 300K SDEX
          buyAmount: '1200000000', // 1200 USDC
        },
      ],
      [
        {
          name: 'WBTC',
          sellAmount: '5000000', // 0.05 WBTC
          buyAmount: '31000000000000000000000', // 31K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '31000000000000000000000', // 31K SDEX
          buyAmount: '5000000', // 0.05 WBTC
        },
      ],
    ]
      .map((pair, i, arr) => [
        [pair],
        [
          arr[i].map(token => ({
            ...token,
            sellAmount: token.sellAmount + '0',
            buyAmount: token.buyAmount + '0',
          })),
        ],
      ])
      .flat(2),
    [Network.BSC]: [
      [
        {
          name: 'USDT',
          sellAmount: '1200000000000000000000', // 1200 USDT
          buyAmount: '300000000000000000000000', // 300K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000', // 300K SDEX
          buyAmount: '120000000000000000000', // 1200 USDT
        },
      ],
      [
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000', // 300K SDEX
          buyAmount: '50000000000000000', // 0.05 bBTC
        },
        {
          name: 'bBTC',
          sellAmount: '50000000000000000', // 0.05 bBTC
          buyAmount: '300000000000000000000000', // 300K SDEX
        },
      ],
      [
        {
          name: 'USDT',
          sellAmount: '1500000000000000000000', // 1500 USDT
          buyAmount: '20000000000000000000', // 20 BNB
        },
        {
          name: 'BNB',
          sellAmount: '20000000000000000000', // 20 BNB
          buyAmount: '1500000000000000000000', // 1500 USDT
        },
      ],
    ]
      .map((pair, i, arr) => [
        [pair],
        [
          arr[i].map(token => ({
            ...token,
            sellAmount: token.sellAmount + '0',
            buyAmount: token.buyAmount + '0',
          })),
        ],
      ])
      .flat(2),
    [Network.POLYGON]: [
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000', // 1.5 WETH
          buyAmount: '250000000000000000000000', // 250K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '250000000000000000000000', // 250K SDEX
          buyAmount: '1500000000000000000', // 1.5 WETH
        },
      ],
      [
        {
          name: 'USDC',
          sellAmount: '2500000000', // 2500 USDC
          buyAmount: '300000000000000000000000', // 300K SDEX
        },
        {
          name: 'SDEX',
          sellAmount: '300000000000000000000000', // 300K SDEX
          buyAmount: '2500000000', // 2500 USDC
        },
      ],
      [
        {
          name: 'USDC',
          sellAmount: '2500000000', // 2500 USDC
          buyAmount: '8000000000000000000000', // 8000 MATIC
        },
        {
          name: 'MATIC',
          sellAmount: '8000000000000000000000', // 8000 MATIC
          buyAmount: '2500000000', // 2500 USDC
        },
      ],
      [
        {
          name: 'SDEX',
          sellAmount: '190000000000000000000000', // 190K SDEX
          buyAmount: '8000000', // 0.08 WBTC
        },
        {
          name: 'WBTC',
          sellAmount: '8000000', // 0.08 WBTC
          buyAmount: '190000000000000000000000', // 190K SDEX
        },
      ],
    ]
      .map((pair, i, arr) => [
        [pair],
        [
          arr[i].map(token => ({
            ...token,
            sellAmount: token.sellAmount + '0',
            buyAmount: token.buyAmount + '0',
          })),
        ],
      ])
      .flat(2),

    [Network.BASE]: [
      [
        {
          name: 'WETH',
          sellAmount: '1500000000000000000', // 1.5 WETH
          buyAmount: '2500000000', // 2.5k USDbC
        },
        {
          name: 'USDbC',
          sellAmount: '2500000000', // 2.5k USDbC
          buyAmount: '1500000000000000000', // 1.5 WETH
        },
      ],
      //  TenderlySimulation_simulate: Error: Request failed with status code 400
      // [
      //   {
      //     name: 'WETH',
      //     sellAmount: '1500000000000000000', // 1.5 WETH
      //     buyAmount: '250000000000000000000000', // 250K SDEX
      //   },
      //   {
      //     name: 'SDEX',
      //     sellAmount: '250000000000000000000000', // 250K SDEX
      //     buyAmount: '1500000000000000000', // 1.5 WETH
      //   },
      // ],
    ]
      .map((pair, i, arr) => [
        [pair],
        [
          arr[i].map(token => ({
            ...token,
            sellAmount: token.sellAmount + '0',
            buyAmount: token.buyAmount + '0',
          })),
        ],
      ])
      .flat(2),
  };

  const networkKeys = [
    // Network.MAINNET,
    // Network.ARBITRUM,
    // Network.BSC,
    // Network.POLYGON,
    Network.BASE,
  ];
  networkKeys.forEach(network => {
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe(`Smardex Swap on Chain ${network}`, () => {
      const dexKey = 'Smardex';

      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            // ContractMethod.multiSwap, // TODO: uncomment when Adapter is ready to enable Multiswap
            // ContractMethod.megaSwap, // TODO: uncomment when Adapter is ready to enable Megaswap
          ],
        ],
        [SwapSide.BUY, [ContractMethod.simpleBuy]],
      ]);

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: ContractMethod) => {
            allPairs[network].forEach(pair => {
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
    });
  });
});
