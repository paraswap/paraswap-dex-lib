import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

const sleepMs: number = 5000;

describe('SwaapV2 E2E', () => {
  const dexKey = 'SwaapV2';

  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
    [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
  ]);

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    const tokens = Tokens[network];
    const holders = Holders[network];

    const pairs: { name: string; sellAmount: string; buyAmount: string }[][] = [
      [
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '1000000000000000000',
        },
        {
          name: 'WETH',
          sellAmount: '1000000000000000000',
          buyAmount: '100000000',
        },
      ],
      [
        {
          name: 'MATIC',
          sellAmount: '150000000000000000000',
          buyAmount: '100000000',
        },
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '150000000000000000000',
        },
      ],
      [
        {
          name: 'WMATIC',
          sellAmount: '150000000000000000000',
          buyAmount: '100000000',
        },
        {
          name: 'USDC',
          sellAmount: '100000000',
          buyAmount: '150000000000000000000',
        },
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
                  side === SwapSide.SELL
                    ? pair[0].sellAmount
                    : pair[0].buyAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  sleepMs,
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
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  sleepMs,
                );
              });
            });
          });
        });
      }),
    );
  });

  // Arbitrum will be supported later
  // describe('Arbitrum', () => {
  //   const network = Network.ARBITRUM;
  //
  //   const tokenASymbol: string = 'ETH';
  //   const tokenBSymbol: string = 'DAI';
  //
  //   const tokenAAmount: string = '100000000';
  //   const tokenBAmount: string = '1000000000000000000';
  //   const nativeTokenAmount = '1000000000000000000';
  //
  //   testForNetwork(
  //     network,
  //     dexKey,
  //     tokenASymbol,
  //     tokenBSymbol,
  //     tokenAAmount,
  //     tokenBAmount,
  //     nativeTokenAmount,
  //   );
  // });

  // Mainnet will be supported later
  // describe('Mainnet', () => {
  //   const network = Network.MAINNET;
  //   const tokenASymbol: string = 'USDC';
  //   const tokenBSymbol: string = 'USDT';
  //
  //   const tokenAAmount: string = '100000000';
  //   const tokenBAmount: string = '1000000000000000000';
  //   const nativeTokenAmount = '1000000000000000000';
  //
  //   testForNetwork(
  //     network,
  //     dexKey,
  //     tokenASymbol,
  //     tokenBSymbol,
  //     tokenAAmount,
  //     tokenBAmount,
  //     nativeTokenAmount,
  //   );
  // });
});
