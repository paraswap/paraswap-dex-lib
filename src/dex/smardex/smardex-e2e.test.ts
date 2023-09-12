import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Smardex E2E Mainnet', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('Smardex Swap', () => {
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
      // [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    const pairsSmallAmount: { name: string; sellAmount: string; buyAmount: string }[][] = [
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
    ];

    // multiply all amounts by 10
    const pairsBigAmount: { name: string; sellAmount: string; buyAmount: string  }[][] =
      pairsSmallAmount.map((pair) =>
        pair.map((token) => ({ ...token, sellAmount: token.sellAmount + '0', buyAmount: token.buyAmount + '0' })),
      );

    // copy smallAmount and bigAmount into the same array alternatively to get same pairs together
    const pairs = pairsSmallAmount.map((small, index) => ([small, pairsBigAmount[index]])).flat(1);

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
  });
});
