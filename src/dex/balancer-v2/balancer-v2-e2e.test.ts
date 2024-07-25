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
import { DirectMethodsV6 } from './constants';

jest.setTimeout(50 * 1000);

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
        // ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
        ContractMethod.swapExactAmountIn,
      ],
    ],
    [
      SwapSide.BUY,
      [
        // ContractMethod.simpleBuy,
        // ContractMethod.buy,
        // DirectMethodsV6.directBuy,
        ContractMethod.swapExactAmountOut,
      ],
    ],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: string) => {
          describe(`${contractMethod}`, () => {
            it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[nativeTokenSymbol],
                tokens[tokenASymbol],
                holders[nativeTokenSymbol],
                side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod as any,
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
                contractMethod as any,
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
                contractMethod as any,
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

describe('BalancerV2 E2E', () => {
  describe('BalancerV2 MAINNET', () => {
    const dexKey = 'BalancerV2';
    const network = Network.MAINNET;
    const tokens = Tokens[Network.MAINNET];
    const holders = Holders[Network.MAINNET];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Weighted Pool', () => {
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
              name: 'WETH',
              sellAmount: '20000000000',
              buyAmount: '100000000000000000000000',
            },
            {
              name: 'PSP',
              sellAmount: '200000000000000',
              buyAmount: '1871289184941469675',
            },
          ],
          [
            {
              name: 'BAL',
              sellAmount: '100000',
              buyAmount: '10000000000000',
            },
            {
              name: 'WETH',
              sellAmount: '200000000000000',
              buyAmount: '1871289184',
            },
          ],
          [
            {
              name: 'OHM',
              sellAmount: '20000000000',
              buyAmount: '1000000000000',
            },
            {
              name: 'DAI',
              sellAmount: '200000000000000',
              buyAmount: '20000000000',
            },
          ],
          [
            {
              name: 'OHM',
              sellAmount: '20000000000',
              buyAmount: '10000000000000',
            },
            {
              name: 'WETH',
              sellAmount: '200000000000000',
              buyAmount: '10000000000',
            },
          ],
          [
            {
              name: 'WETH',
              sellAmount: '20000000000',
              buyAmount: '10000000000000',
            },
            {
              name: 'AURA',
              sellAmount: '200000000000000',
              buyAmount: '10000000000',
            },
          ],
          [
            {
              name: 'USDC',
              sellAmount: '111000000',
              buyAmount: '111000000',
            },
            {
              name: 'wstETH',
              sellAmount: '100000000000000000',
              buyAmount: '100000000000000000',
            },
          ],
        ];

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: string) => {
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
                    contractMethod as any,
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
                    contractMethod as any,
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

    describe('Popular tokens', () => {
      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            ContractMethod.multiSwap,
            ContractMethod.megaSwap,
          ],
        ],
        [
          SwapSide.BUY,
          [
            // Buy support is enabled only for Weighted Pools
            // ContractMethod.simpleBuy,
            // ContractMethod.buy
          ],
        ],
      ]);

      const pairs: { name: string; sellAmount: string; buyAmount: string }[][] =
        [
          [
            {
              name: 'USDC',
              sellAmount: '100000000',
              buyAmount: '100000000',
            },
            {
              name: 'USDT',
              sellAmount: '1000000000',
              buyAmount: '1000000000000',
            },
          ],
          [
            {
              name: 'USDT',
              sellAmount: '1000000000000',
              buyAmount: '1000000000000',
            },
            {
              name: 'USDC',
              sellAmount: '1000000000',
              buyAmount: '1000000000000',
            },
          ],
          [
            {
              name: 'ETH',
              sellAmount: '2000000000000',
              buyAmount: '100000000',
            },
            {
              name: 'USDC',
              sellAmount: '37690000',
              buyAmount: '20035947428035770',
            },
          ],
          [
            {
              name: 'WETH',
              sellAmount: '70000000000000',
              buyAmount: '100000000',
            },
            {
              name: 'USDC',
              sellAmount: '1000000000',
              buyAmount: '20000947428035770',
            },
          ],
          [
            {
              name: 'USDC',
              sellAmount: '10000000000',
              buyAmount: '10000000000000000000',
            },
            {
              name: 'DAI',
              sellAmount: '200000000000000',
              buyAmount: '2000000000000',
            },
          ],
          [
            {
              name: 'wstETH',
              sellAmount: '3000000000000000000',
              buyAmount: '3000000000000000000',
            },
            {
              name: 'ETH',
              sellAmount: '200000000000',
              buyAmount: '7000000000000000000',
            },
          ],
          [
            {
              name: 'WETH',
              sellAmount: '20000000000',
              buyAmount: '100000000000000000000000',
            },
            {
              name: 'PSP',
              sellAmount: '200000000000000',
              buyAmount: '1871289184941469675',
            },
          ],
          [
            {
              name: 'WETH',
              sellAmount: '200000000000000000',
              buyAmount: '20000',
            },
            {
              name: 'WBTC',
              sellAmount: '200000000',
              buyAmount: '200000000000000000',
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

    describe('GearboxLinear pool', () => {
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

      const pairs: { name: string; amount: string }[][] = [
        [
          { name: 'USDC', amount: '1000000000' },
          { name: 'dUSDC', amount: '100000000000' },
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
                    pair[0].amount,
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
                    pair[1].amount,
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

    describe('GyroE pool', () => {
      const sideToContractMethods = new Map([
        [
          SwapSide.SELL,
          [
            ContractMethod.simpleSwap,
            // ContractMethod.multiSwap,
            // ContractMethod.megaSwap,
          ],
        ],
        // [
        // SwapSide.BUY,
        // [
        //   ContractMethod.simpleBuy,
        //   ContractMethod.buy
        // ],
        // ],
      ]);

      const pairs: { name: string; amount: string }[][] = [
        [
          { name: 'GYD', amount: '10000000000000000000' },
          { name: 'sDAI', amount: '10000000000000000000' },
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
                    pair[0].amount,
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
                    pair[1].amount,
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

    //daniel: BPT swaps are currently not supported, we've refactored to focus on mainToken paths
    /*it('MAIN TOKEN -> BPT, LinearPool', async () => {
        // Linear Pools allow swaps between main token (i.e. USDT) and pools BPT
        await testE2E(
          tokens['USDT'],
          tokens['BBAUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> WRAPPED TOKEN, LinearPool', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['waUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });*/
    // NO HOLDERS OF waUSDT (ONLY VAULT)
    // it('WRAPPED TOKEN -> BPT, LinearPool', async () => {
    //   // Linear Pools allow swaps between wrapped token (i.e. waUSDT) and pools BPT
    //   await testE2E(
    //     tokens['waUSDT'],
    //     tokens['BBAUSDT'],
    //     holders['waUSDT'],
    //     '20000000',
    //     SwapSide.SELL,
    //     dexKey,
    //     ContractMethod.simpleSwap,
    //     network,
    //     provider,
    //   );
    // });
    // NO HOLDERS OF BBADAI (ONLY VAULT)
    // it('WRAPPED TOKEN -> MAIN TOKEN, LinearPool', async () => {
    //   await testE2E(
    //     tokens['waUSDT'],
    //     tokens['BBAUSDT'],
    //     holders['waUSDT'],
    //     '20000000',
    //     SwapSide.SELL,
    //     dexKey,
    //     ContractMethod.simpleSwap,
    //     network,
    //     provider,
    //   );
    // });
    // NO HOLDERS OF BBADAI (ONLY VAULT)
    // it('BPT -> MAIN TOKEN, LinearPool', async () => {
    //   // Linear Pools allow swaps between main token (i.e. USDT) and pools BPT
    //   await testE2E(
    //     tokens['BBADAI'],
    //     tokens['DAI'],
    //     holders['BBADAI'],
    //     '20000000',
    //     SwapSide.SELL,
    //     dexKey,
    //     ContractMethod.simpleSwap,
    //     network,
    //     provider,
    //   );
    // });
    // it('BPT -> WRAPPED TOKEN, LinearPool', async () => {
    //   // Linear Pools allow swaps between wrapped token (i.e. waDAI) and pools BPT
    //   await testE2E(
    //     tokens['BBADAI'],
    //     tokens['waDAI'],
    //     holders['BBADAI'],
    //     '20000000',
    //     SwapSide.SELL,
    //     dexKey,
    //     ContractMethod.simpleSwap,
    //     network,
    //     provider,
    //   );
    // });

    //daniel: BPT swaps are currently not supported, we've refactored to focus on mainToken paths
    /*it('BPT -> TOKEN, PhantomStablePool', async () => {
        // PhantomStable allows swaps between BPT and tokens
        await testE2E(
          tokens['BBAUSD'],
          tokens['BBADAI'],
          holders['BBAUSD'],
          '20000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> BPT, ERC4626 Linear Pool', async () => {
        await testE2E(
          tokens['DAI'],
          tokens['BBFDAI'],
          holders['DAI'],
          '20000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });*/

    //daniel: BPT swaps are currently not supported, we've refactored to focus on mainToken paths
    /*
      it('MAIN TOKEN -> BPT, LinearPool', async () => {
        // Linear Pools allow swaps between main token (i.e. USDT) and pools BPT
        await testE2E(
          tokens['USDT'],
          tokens['BBAUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> WRAPPED TOKEN, LinearPool', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['waUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BPT -> TOKEN, PhantomStablePool', async () => {
        // PhantomStable allows swaps between BPT and tokens
        await testE2E(
          tokens['BBAUSD'],
          tokens['BBAUSDT'],
          holders['BBAUSD'],
          '20000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> BPT, ERC4626 Linear Pool', async () => {
        await testE2E(
          tokens['DAI'],
          tokens['BBFDAI'],
          holders['DAI'],
          '20000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      */
  });

  describe('BalancerV2 Polygon_V6', () => {
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
          // ContractMethod.simpleSwap,
          // ContractMethod.multiSwap,
          // ContractMethod.megaSwap,
          // ContractMethod.directBalancerV2GivenInSwap,
          ContractMethod.swapExactAmountIn,
          ContractMethod.swapExactAmountInOnBalancerV2,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.directBalancerV2GivenOutSwap,
          // ContractMethod.simpleBuy,
          // ContractMethod.buy,
          ContractMethod.swapExactAmountOut,
          ContractMethod.swapExactAmountOutOnBalancerV2,
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

    it('USDC -> USDT through Gyro3', async () => {
      await testE2E(
        tokens['USDC'],
        tokens['USDT'],
        holders['USDC'],
        '10000000', // 10 * 1e6
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
        // [`${dexKey}_0x17f1ef81707811ea15d9ee7c741179bbe2a63887`],
      );
    });

    it('USDC -> USDT through Gyro3 (BUY)', async () => {
      await testE2E(
        tokens['USDC'],
        tokens['USDT'],
        holders['USDC'],
        '10000000', // 10 * 1e6
        SwapSide.BUY,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
        // [`${dexKey}_0x17f1ef81707811ea15d9ee7c741179bbe2a63887`],
      );
    });
  });

  describe('BalancerV2 ARBITRUM', () => {
    const dexKey = 'BalancerV2';
    const network = Network.ARBITRUM;
    const tokens = Tokens[Network.ARBITRUM];
    const holders = Holders[Network.ARBITRUM];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Weighted Pool', () => {
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
              name: 'RDNT',
              sellAmount: '100000000000000000',
              buyAmount: '100000000000000',
            },
            {
              name: 'WETH',
              sellAmount: '100000000000000',
              buyAmount: '1871289184',
            },
          ],
          [
            {
              name: 'USDC',
              sellAmount: '10000',
              buyAmount: '2000',
            },
            {
              name: 'OHM',
              sellAmount: '1000',
              buyAmount: '1871289184',
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

    describe('Simpleswap', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['USDC'],
          holders['ETH'],
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WETH'],
          holders['USDC'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['USDC'],
          holders['ETH'],
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WETH'],
          holders['USDC'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('BeetsFi FANTOM', () => {
    const dexKey = 'BeetsFi';
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Simpleswap', () => {
      it('FTM -> BOO', async () => {
        await testE2E(
          tokens['FTM'],
          tokens['BOO'],
          holders['FTM'],
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('WETH -> FTM', async () => {
        await testE2E(
          tokens['WETH'],
          tokens['FTM'],
          holders['WETH'],
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('FTM -> TOKEN', async () => {
        await testE2E(
          tokens['FTM'],
          tokens['USDC'],
          holders['FTM'],
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> FTM', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['FTM'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WFTM'],
          holders['USDC'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('FTM -> TOKEN', async () => {
        await testE2E(
          tokens['FTM'],
          tokens['USDC'],
          holders['FTM'],
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> FTM', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['FTM'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WFTM'],
          holders['USDC'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('BalancerV2 Polygon', () => {
    const dexKey = 'BalancerV2';
    const network = Network.POLYGON;
    const tokens = Tokens[Network.POLYGON];
    const holders = Holders[Network.POLYGON];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Weighted Pool', () => {
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
              name: 'WMATIC',
              sellAmount: '20000000000000',
              buyAmount: '200000000',
            },
            {
              name: 'USDC',
              sellAmount: '200000000',
              buyAmount: '2000000000000000',
            },
          ],
          [
            {
              name: 'WBTC',
              sellAmount: '10000000',
              buyAmount: '200000000',
            },
            {
              name: 'USDC',
              sellAmount: '200000000',
              buyAmount: '1000000',
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
  });

  describe('BalancerV2 Avalanche', () => {
    const dexKey = 'BalancerV2';
    const network = Network.AVALANCHE;
    const tokens = Tokens[Network.AVALANCHE];
    const holders = Holders[Network.AVALANCHE];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('ComposableStable', () => {
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

      const pairs: { name: string; sellAmount: string; buyAmount: string }[][] =
        [
          [
            {
              name: 'sAVAX',
              sellAmount: '20000000000000',
              buyAmount: '200000000',
            },
            {
              name: 'AVAX',
              sellAmount: '200000000',
              buyAmount: '2000000000000000',
            },
          ],
          [
            {
              name: 'USDT',
              sellAmount: '20000000',
              buyAmount: '200000000',
            },
            {
              name: 'USDC',
              sellAmount: '200000000',
              buyAmount: '2000000000',
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

    describe('Weighted Pool', () => {
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
              name: 'BETS',
              sellAmount: '20000000000000',
              buyAmount: '200000000',
            },
            {
              name: 'sAVAX',
              sellAmount: '200000000',
              buyAmount: '2000000000000000',
            },
          ],
          [
            {
              name: 'HATCHY',
              sellAmount: '20000000000000',
              buyAmount: '200000000',
            },
            {
              name: 'AVAX',
              sellAmount: '200000000',
              buyAmount: '2000000000000000',
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
  });

  describe('BalancerV2 Base', () => {
    const dexKey = 'BalancerV2';
    const network = Network.BASE;

    describe('USDC -> GOLD', () => {
      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'GOLD';

      const tokenAAmount: string = '11110010';
      const tokenBAmount: string = '210000000000000000000';
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

  describe('BalancerV2 Rehype Pools', () => {
    const dexKey = 'BalancerV2';

    describe('Mainnet', () => {
      const network = Network.MAINNET;

      describe('GYD -> stataEthUSDT', () => {
        const tokenASymbol: string = 'GYD';
        const tokenBSymbol: string = 'stataEthUSDT';

        const tokenAAmount: string = '81442000000000000';
        const tokenBAmount: string = '47438';

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
              ContractMethod.swapExactAmountIn,
              ContractMethod.swapExactAmountInOnBalancerV2,
            ],
          ],
          [
            SwapSide.BUY,
            [
              ContractMethod.swapExactAmountOut,
              ContractMethod.swapExactAmountOutOnBalancerV2,
            ],
          ],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });
    });

    describe('Polygon', () => {
      const network = Network.POLYGON;

      describe('stataPolUSDT -> stataPolUSDCn', () => {
        const tokenASymbol: string = 'stataPolUSDT';
        const tokenBSymbol: string = 'stataPolUSDCn';

        const tokenAAmount: string = '110000';
        const tokenBAmount: string = '110000';

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
              ContractMethod.swapExactAmountIn,
              ContractMethod.swapExactAmountInOnBalancerV2,
            ],
          ],
          [
            SwapSide.BUY,
            [
              ContractMethod.swapExactAmountOut,
              ContractMethod.swapExactAmountOutOnBalancerV2,
            ],
          ],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });

      describe('paUSD -> stataPolUSDCn', () => {
        const tokenASymbol: string = 'paUSD';
        const tokenBSymbol: string = 'stataPolUSDCn';

        const tokenAAmount: string = '500000000000000000';
        const tokenBAmount: string = '572802';

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
              ContractMethod.swapExactAmountIn,
              ContractMethod.swapExactAmountInOnBalancerV2,
            ],
          ],
          [
            SwapSide.BUY,
            [
              ContractMethod.swapExactAmountOut,
              ContractMethod.swapExactAmountOutOnBalancerV2,
            ],
          ],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });
    });

    describe('Base', () => {
      const network = Network.BASE;

      describe('stataBasUSDC -> sDAI', () => {
        const tokenASymbol: string = 'stataBasUSDC';
        const tokenBSymbol: string = 'sDAI';

        const tokenAAmount: string = '11110010';
        const tokenBAmount: string = '11000000000000000000';

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
              ContractMethod.swapExactAmountIn,
              ContractMethod.swapExactAmountInOnBalancerV2,
            ],
          ],
          [
            SwapSide.BUY,
            [
              ContractMethod.swapExactAmountOut,
              ContractMethod.swapExactAmountOutOnBalancerV2,
            ],
          ],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });
    });

    describe('Arbitrum', () => {
      const network = Network.ARBITRUM;

      describe('stataArbUSDT -> GYD', () => {
        const tokenASymbol: string = 'stataArbUSDT';
        const tokenBSymbol: string = 'GYD';

        const tokenAAmount: string = '100000';
        const tokenBAmount: string = '8685800000000000';

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
              ContractMethod.swapExactAmountIn,
              ContractMethod.swapExactAmountInOnBalancerV2,
            ],
          ],
          [
            SwapSide.BUY,
            [
              ContractMethod.swapExactAmountOut,
              ContractMethod.swapExactAmountOutOnBalancerV2,
            ],
          ],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });

      describe('stataArbUSDCn -> GYD', () => {
        const tokenASymbol: string = 'stataArbUSDCn';
        const tokenBSymbol: string = 'GYD';

        const tokenAAmount: string = '100000';
        const tokenBAmount: string = '8685800000000000';

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
              ContractMethod.swapExactAmountIn,
              ContractMethod.swapExactAmountInOnBalancerV2,
            ],
          ],
          [
            SwapSide.BUY,
            [
              ContractMethod.swapExactAmountOut,
              ContractMethod.swapExactAmountOutOnBalancerV2,
            ],
          ],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });
    });

    describe('BeetsFi Optimism', () => {
      const dexKey = 'BeetsFi';
      const network = Network.OPTIMISM;

      describe('stataOptUSDT -> stataOptUSDCn', () => {
        const tokenASymbol: string = 'stataOptUSDT';
        const tokenBSymbol: string = 'stataOptUSDCn';

        const tokenAAmount: string = '110000';
        const tokenBAmount: string = '110000';

        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const tokens = Tokens[network];
        const holders = Holders[network];

        const sideToContractMethods = new Map([
          [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
          [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });

      describe('sDAI -> stataOptUSDCn', () => {
        const tokenASymbol: string = 'sDAI';
        const tokenBSymbol: string = 'stataOptUSDCn';

        const tokenAAmount: string = '280211000000000000';
        const tokenBAmount: string = '314784';

        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const tokens = Tokens[network];
        const holders = Holders[network];

        const sideToContractMethods = new Map([
          [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
          [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
        ]);

        describe(`${network}`, () => {
          sideToContractMethods.forEach((contractMethods, side) =>
            describe(`${side}`, () => {
              contractMethods.forEach((contractMethod: ContractMethod) => {
                describe(`${contractMethod}`, () => {
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
                      200,
                    );
                  });
                  it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                    await testE2E(
                      tokens[tokenBSymbol],
                      tokens[tokenASymbol],
                      holders[tokenBSymbol],
                      side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                      undefined,
                      undefined,
                      undefined,
                      200,
                    );
                  });
                });
              });
            }),
          );
        });
      });
    });
  });

  describe('BalancerV2_MAINNET', () => {
    const dexKey = 'BalancerV2';
    const network = Network.MAINNET;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '11110010';
    const tokenBAmount: string = '21000000';
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

  // describe('BeetsFi OPTIMISM', () => {
  //   const dexKey = 'BeetsFi';
  //   const network = Network.OPTIMISM;
  //   const tokens = Tokens[network];
  //   const holders = Holders[network];
  //   const provider = new StaticJsonRpcProvider(
  //     generateConfig(network).privateHttpProvider,
  //     network,
  //   );
  //   const BBAUSD_OP = '0x6222ae1d2a9f6894da50aa25cb7b303497f9bebd';
  //   const BBAUSDMAI_OP = '0x1f131ec1175f023ee1534b16fa8ab237c00e2381';
  //   const LIDO_SHUFFLE = '0xde45f101250f2ca1c0f8adfc172576d10c12072d';
  //   const YELLOW_SUBMARINE = '0x981fb05b738e981ac532a99e77170ecb4bc27aef';

  //   describe('Simpleswap', () => {
  //     it('ETH -> TOKEN', async () => {
  //       await testE2E(
  //         tokens['ETH'],
  //         tokens['USDC'],
  //         holders['ETH'],
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //     it('TOKEN -> ETH', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['ETH'],
  //         holders['USDC'],
  //         '2000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //     it('TOKEN -> TOKEN', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['WETH'],
  //         holders['USDC'],
  //         '20000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //     it('USDC -> DAI using bbaUSD', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['DAI'],
  //         holders['USDC'],
  //         '20000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${BBAUSD_OP}`],
  //       );
  //     });
  //     it('DAI -> USDT using bbaUSD', async () => {
  //       await testE2E(
  //         tokens['DAI'],
  //         tokens['USDT'],
  //         holders['DAI'],
  //         '1000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${BBAUSD_OP}`],
  //       );
  //     });
  //     it('USDC -> MAI through bbaUSD-MAI', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['MAI'],
  //         holders['USDC'],
  //         '20000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${BBAUSDMAI_OP}`],
  //       );
  //     });
  //     it('wstETH -> WETH through composable stable', async () => {
  //       await testE2E(
  //         tokens['wstETH'],
  //         tokens['WETH'],
  //         holders['wstETH'],
  //         '10000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${LIDO_SHUFFLE}`],
  //       );
  //     });
  //     it('wstETH -> ETH through composable stable', async () => {
  //       await testE2E(
  //         tokens['wstETH'],
  //         tokens['ETH'],
  //         holders['wstETH'],
  //         '10000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${LIDO_SHUFFLE}`],
  //       );
  //     });
  //     it('ETH -> wstETH through composable stable', async () => {
  //       await testE2E(
  //         tokens['ETH'],
  //         tokens['wstETH'],
  //         holders['ETH'],
  //         '10000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${LIDO_SHUFFLE}`],
  //       );
  //     });
  //     it('wstETH -> WBTC through boosted weighted', async () => {
  //       await testE2E(
  //         tokens['wstETH'],
  //         tokens['WBTC'],
  //         holders['wstETH'],
  //         '25000000000000000', //1e18
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${YELLOW_SUBMARINE}`],
  //       );
  //     });
  //     it('USDC -> WBTC through boosted weighted', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['WBTC'],
  //         holders['USDC'],
  //         '1000000', //1e6
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${YELLOW_SUBMARINE}`],
  //       );
  //     });
  //     it('wstETH -> USDC  through boosted weighted', async () => {
  //       await testE2E(
  //         tokens['wstETH'],
  //         tokens['USDC'],
  //         holders['wstETH'],
  //         '1000000000000000000', //1e18
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${YELLOW_SUBMARINE}`],
  //       );
  //     });
  //   });

  //   describe('Multiswap', () => {
  //     it('ETH -> TOKEN', async () => {
  //       await testE2E(
  //         tokens['ETH'],
  //         tokens['USDC'],
  //         holders['ETH'],
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //     it('TOKEN -> ETH', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['ETH'],
  //         holders['USDC'],
  //         '2000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //     it('TOKEN -> TOKEN', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['WETH'],
  //         holders['USDC'],
  //         '20000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //     it('USDC -> DAI using bbaUSD', async () => {
  //       await testE2E(
  //         tokens['USDC'],
  //         tokens['DAI'],
  //         holders['USDC'],
  //         '20000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${BBAUSD_OP}`],
  //       );
  //     });
  //     it('wstETH -> USDC  through boosted weighted', async () => {
  //       await testE2E(
  //         tokens['wstETH'],
  //         tokens['USDC'],
  //         holders['wstETH'],
  //         '1000000000000000000', //1e18
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //         [`${dexKey}_${YELLOW_SUBMARINE}`],
  //       );
  //     });
  //   });
  // });
});
