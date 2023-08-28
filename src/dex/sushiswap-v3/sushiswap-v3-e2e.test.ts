import dotenv from 'dotenv';
dotenv.config();

import { ContractMethod, Network, SwapSide } from '../../constants';
import {
  Holders,
  NativeTokenSymbols,
  Tokens,
} from '../../../tests/constants-e2e';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { testE2E } from '../../../tests/utils-e2e';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
  slippage?: number | undefined,
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
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
        // ContractMethod.directUniV3Swap,
      ],
    ],
    [
      SwapSide.BUY,
      [
        ContractMethod.simpleBuy,
        // ContractMethod.buy,
        // ContractMethod.directUniV3Buy,
      ],
    ],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[nativeTokenSymbol],
                tokens[tokenASymbol],
                holders[nativeTokenSymbol],
                side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
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
            it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[nativeTokenSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
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
            it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
                undefined,
                undefined,
                undefined,
                slippage,
              );
            });
          });
        });
      }),
    );
  });
}

describe('SushiSwapV3 E2E', () => {
  const dexKey = 'SushiSwapV3';

  describe('MAINNET', () => {
    const network = Network.MAINNET;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '111110000';
    const tokenBAmount: string = '1100000000';
    const nativeTokenAmount = '11000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      500, // 5%
    );
  });

  describe('ARBITRUM', () => {
    const network = Network.ARBITRUM;

    const tokenASymbol: string = 'USDCe';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '11111000';
    const tokenBAmount: string = '10000000';
    const nativeTokenAmount = '11000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      500, // 5%
    );
  });

  describe('POLYGON', () => {
    const network = Network.POLYGON;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '21111000';
    const tokenBAmount: string = '200000000';
    const nativeTokenAmount = '110000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      500, // 5%
    );
  });

  describe('BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
          ContractMethod.directUniV3Swap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          ContractMethod.simpleBuy,
          ContractMethod.buy,
          ContractMethod.directUniV3Buy,
        ],
      ],
    ]);

    const pairs: { name: string; sellAmount: string; buyAmount: string }[][] = [
      [
        {
          name: 'USDC',
          sellAmount: '100000000000000000000',
          buyAmount: '100000000000000000000',
        },
        {
          name: 'USDT',
          sellAmount: '100000000000000000000',
          buyAmount: '100000000000000000000',
        },
      ],
      [
        {
          name: 'BNB',
          sellAmount: '1000000000000000000',
          buyAmount: '10000000000000000000',
        },
        {
          name: 'USDT',
          sellAmount: '1000000000000000000000',
          buyAmount: '20000000000000000',
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

  describe('AVALANCHE', () => {
    const network = Network.AVALANCHE;

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '111110';
    const tokenBAmount: string = '100000';
    const nativeTokenAmount = '11000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      500, // 5%
    );
  });

  describe('FANTOM', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
          ContractMethod.directUniV3Swap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          ContractMethod.simpleBuy,
          ContractMethod.buy,
          ContractMethod.directUniV3Buy,
        ],
      ],
    ]);

    const pairs: { name: string; sellAmount: string; buyAmount: string }[][] = [
      [
        {
          name: 'USDC',
          sellAmount: '111110',
          buyAmount: '111110',
        },
        {
          name: 'FUSDT',
          sellAmount: '111110',
          buyAmount: '111110',
        },
      ],
      // [
      //   {
      //     name: 'BNB',
      //     sellAmount: '1000000000000000000',
      //     buyAmount: '10000000000000000000',
      //   },
      //   { name: 'USDT', sellAmount: '1000000000000000000000', buyAmount: '20000000000000000' },
      // ],
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

  describe('OPTIMISM', () => {
    const network = Network.OPTIMISM;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '111110000';
    const tokenBAmount: string = '10000000';
    const nativeTokenAmount = '11000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      500, // 5%
    );
  });
});
