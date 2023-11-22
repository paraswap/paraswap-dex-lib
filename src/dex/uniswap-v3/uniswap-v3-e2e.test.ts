import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Holders,
  NativeTokenSymbols,
  Tokens,
} from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

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
    // [
    //   SwapSide.BUY,
    //   [
    //     ContractMethod.simpleBuy,
    //     ContractMethod.buy,
    //     ContractMethod.directUniV3Buy,
    //   ],
    // ],
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
                2000,
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
                2000,
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
                2000,
              );
            });
          });
        });
      }),
    );
  });
}

describe('UniswapV3 E2E', () => {
  describe('UniswapV3', () => {
    const dexKey = 'UniswapV3';

    describe('UniswapV3 MAINNET', () => {
      const network = Network.MAINNET;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDT';

      const tokenAAmount: string = '11111000000';
      const tokenBAmount: string = '11000000000';
      const nativeTokenAmount = '1100000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });

    describe('UniswapV3 POLYGON', () => {
      const network = Network.POLYGON;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'WETH';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '11000000';
      const tokenBAmount: string = '11000000000000000000';
      const nativeTokenAmount = '11000000000000000000';

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

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
              );
            });
          });
        }),
      );
    });

    describe('UniswapV3 BSC', () => {
      const network = Network.BSC;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'BUSD';
      const tokenBSymbol: string = 'WBNB';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '100000000000000000000';
      const tokenBAmount: string = '1000000000000000000';
      const nativeTokenAmount = '1000000000000000000';

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

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
              );
            });
          });
        }),
      );
    });

    describe('UniswapV3 Optimism', () => {
      const network = Network.OPTIMISM;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'OP';
      const tokenBSymbol: string = 'ETH';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '1000000000000000000';
      const tokenBAmount: string = '1000000000000000000';
      const nativeTokenAmount = '1000000000000000000';

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

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
              );
            });
          });
        }),
      );
    });

    describe('UniswapV3 Base', () => {
      const network = Network.BASE;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'PRIME';
      const tokenBSymbol: string = 'WETH';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '1000000000000000000';
      const tokenBAmount: string = '1000000000000000000';
      const nativeTokenAmount = '1000000000000000000';

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

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenBSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[tokenBSymbol],
                tokens[tokenASymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
              );
            });
          });
        }),
      );
    });

    describe('UniswapV3 Avalanche', () => {
      const network = Network.AVALANCHE;
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
          ],
        ],
        [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
      ]);

      const pairs: { name: string; sellAmount: string; buyAmount: string }[][] =
        [
          [
            {
              name: 'AVAX',
              sellAmount: '1000000000000000000',
              buyAmount: '500000',
            },
            {
              name: 'USDT',
              sellAmount: '1000000',
              buyAmount: '10000000000000000000',
            },
          ],
          [
            {
              name: 'AVAX',
              sellAmount: '1000000000000000000',
              buyAmount: '500000',
            },
            {
              name: 'USDC',
              sellAmount: '1000000',
              buyAmount: '1000000000000000000',
            },
          ],
          [
            {
              name: 'WAVAX',
              sellAmount: '1000000000000000000',
              buyAmount: '500000',
            },
            {
              name: 'USDC',
              sellAmount: '1000000',
              buyAmount: '20000000000000000',
            },
          ],
          [
            {
              name: 'WAVAX',
              sellAmount: '1000000000000000000',
              buyAmount: '10000000',
            },
            { name: 'USDT', sellAmount: '1000000', buyAmount: '2000000000000' },
          ],
          [
            { name: 'USDC', sellAmount: '1000000', buyAmount: '100000000' },
            { name: 'USDT', sellAmount: '100000000', buyAmount: '100000000' },
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
  });

  describe('RamsesV2', () => {
    const dexKey = 'RamsesV2';

    describe('Arbitrum', () => {
      const network = Network.ARBITRUM;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'USDCe';
      const tokenBSymbol: string = 'USDT';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '1100000';
      const tokenBAmount: string = '1000000';
      const nativeTokenAmount = '1100000000000';

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

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
              );
            });
          });
        }),
      );
    });
  });

  describe('ChronosV3', () => {
    const dexKey = 'ChronosV3';
    describe('Arbitrum', () => {
      const network = Network.ARBITRUM;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const tokenASymbol: string = 'USDCe';
      const tokenBSymbol: string = 'USDT';
      const nativeTokenSymbol = NativeTokenSymbols[network];

      const tokenAAmount: string = '2000000';
      const tokenBAmount: string = '2000000';
      const nativeTokenAmount = '100000000000000000';

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

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
              );
            });
            it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
              );
            });
          });
        }),
      );
    });
  });

  describe('V6 Mutiswap test', () => {
    describe('Multiswap USDC -> ETH -> WBTC via SushiSwapV3', () => {
      const dexKeys = ['SushiSwapV3'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'WBTC';

      const tokenAAmount: string = '10000000';
      const tokenBAmount: string = '10038480351';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Multiswap DAI -> USDC -> ETH  via SushiSwapV3', () => {
      const dexKeys = ['SushiSwapV3'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'DAI';
      const tokenBSymbol: string = 'ETH';

      const tokenAAmount: string = '1000000000000000000000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Multiswap ETH -> USDC -> DAI  via SushiSwapV3', () => {
      const dexKeys = ['SushiSwapV3'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'ETH';
      const tokenBSymbol: string = 'DAI';

      const tokenAAmount: string = '100000000000000000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Multiswap USDT -> USDC -> DAI  via SushiSwapV3', () => {
      const dexKeys = ['SushiSwapV3'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'USDT';
      const tokenBSymbol: string = 'DAI';

      const tokenAAmount: string = '100000000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Mutiswap GUSD -> USDC -> ETH via SushiSwapV3 and CurveV1', () => {
      const dexKeys = ['SushiSwapV3', 'CurveV1'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'GUSD';
      const tokenBSymbol: string = 'ETH';

      const tokenAAmount: string = '100000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Mutiswap ETH -> USDC -> GUSD via SushiSwapV3 and CurveV1', () => {
      const dexKeys = ['SushiSwapV3', 'CurveV1'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'ETH';
      const tokenBSymbol: string = 'GUSD';

      const tokenAAmount: string = '100000000000000000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Mutiswap ETH -> USDC -> GUSD via BalancerV1 and CurveV1', () => {
      const dexKeys = ['BalancerV1', 'CurveV1'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'ETH';
      const tokenBSymbol: string = 'GUSD';

      const tokenAAmount: string = '100000000000000000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });

    describe('Multiswap WBTC -> ETH -> SUSHI via BalancerV1 and SushiSwapV3', () => {
      const dexKeys = ['BalancerV1', 'SushiSwapV3'];
      const network = Network.MAINNET;
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );
      const slippage = undefined;

      const tokenASymbol: string = 'WBTC';
      const tokenBSymbol: string = 'SUSHI';

      const tokenAAmount: string = '2000000';

      const tokens = Tokens[network];
      const holders = Holders[network];
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
        );
      });
    });
  });

  describe('SushiSwapV3 E2E', () => {
    const dexKey = 'SushiSwapV3';

    describe('MAINNET', () => {
      const dexKey = 'UniswapV3';

      const network = Network.MAINNET;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDT';

      const tokenAAmount: string = '1000000';
      const tokenBAmount: string = '1100000000';
      const nativeTokenAmount = '1000000000000000000';
      //
      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });

    describe('ARBITRUM', () => {
      const network = Network.ARBITRUM;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDCe';

      const tokenAAmount: string = '10000000';
      const tokenBAmount: string = '10000000';
      const nativeTokenAmount = '900000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
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

      const pairs: { name: string; sellAmount: string; buyAmount: string }[][] =
        [
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

      const pairs: { name: string; sellAmount: string; buyAmount: string }[][] =
        [
          [
            {
              name: 'FTM',
              sellAmount: '100000000000000000',
              buyAmount: '100000000',
            },
            {
              name: 'USDC',
              sellAmount: '100000000',
              buyAmount: '100000000000000000',
            },
          ],
          [
            {
              name: 'WFTM',
              sellAmount: '100000000000000',
              buyAmount: '1000000000000000',
            },
            {
              name: 'WETH',
              sellAmount: '1000000000000000',
              buyAmount: '100000000000000',
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
      );
    });

    describe('BASE', () => {
      const network = Network.BASE;

      const tokenASymbol: string = 'USDbC';
      const tokenBSymbol: string = 'DAI';

      const tokenAAmount: string = '111110000';
      const tokenBAmount: string = '110000000000000000';
      const nativeTokenAmount = '1100000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });
  });

  describe('Retro', () => {
    const dexKey = 'Retro';

    describe('POLYGON', () => {
      const network = Network.POLYGON;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDT';

      const tokenAAmount: string = '1000000000';
      const tokenBAmount: string = '100000000';
      const nativeTokenAmount = '1100000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });
  });

  describe('BaseswapV3 E2E', () => {
    const dexKey = 'BaseswapV3';
    describe('Base', () => {
      const network = Network.BASE;

      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDbC';

      const tokenAAmount: string = '1000000';
      const tokenBAmount: string = '1000000';
      const nativeTokenAmount = '1000000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
      );
    });
  });
});
