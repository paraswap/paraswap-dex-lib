import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../tests/utils-e2e';
import { Holders, NativeTokenSymbols, Tokens } from '../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../config';

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
    [SwapSide.SELL, [ContractMethod.simpleSwap]],
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

jest.setTimeout(200000);
describe('Executor01ByteCodeBuilder e2e tests', () => {
  describe('MAINNET', () => {
    const network = Network.MAINNET;

    describe('SimpleSwap', () => {
      describe('UniswapV3', () => {
        const dexKey = 'UniswapV3';

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'USDT';

        const tokenAAmount: string = '1000000';
        const tokenBAmount: string = '1100000000';
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

      describe('SushiSwapV3', () => {
        const dexKey = 'SushiswapV3';

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

      describe('BalancerV1', () => {
        const dexKey = 'BalancerV1';

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'WBTC';
        const tokenAAmount: string = '3333000000';
        const tokenBAmount: string = '17000000';
        const nativeTokenAmount = '3000000000000000000';

        testForNetwork(
          network,
          dexKey,
          tokenASymbol,
          tokenBSymbol,
          tokenAAmount,
          tokenBAmount,
          nativeTokenAmount,
        );

        const tokens = Tokens[network];
        const holders = Holders[network];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );

        it('simpleSwap USDC -> DAI', async () => {
          await testE2E(
            tokens['USDC'],
            tokens['DAI'],
            holders['USDC'],
            '100000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('BalancerV2', () => {
        const dexKey = 'BalancerV2';

        const tokenASymbol: string = 'USDT';
        const tokenBSymbol: string = 'DAI';
        const tokenAAmount: string = '100000000';
        const tokenBAmount: string = '100000000000000000000';
        const nativeTokenAmount = '500000000000000000';

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

      describe('UniswapV2Fork', () => {
        const dexKey = 'UniswapV2';

        const tokenASymbol: string = 'USDT';
        const tokenBSymbol: string = 'DAI';
        const tokenAAmount: string = '100000000';
        const tokenBAmount: string = '100000000000000000000';
        const nativeTokenAmount = '500000000000000000';

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

      describe('CurveV1', () => {
        const dexKey = 'CurveV1';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );

        const tokensToTest = [
          [
            {
              symbol: 'USDT',
              amount: (10 ** 8).toString(),
            },
            {
              symbol: 'DAI',
              amount: (10 ** 8).toString(),
            },
          ],
          [
            {
              symbol: 'CUSDC',
              amount: (10 ** 8).toString(),
            },
            {
              symbol: 'CDAI',
              amount: (10 ** 8).toString(),
            },
          ],
        ];

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
          contractMethods.forEach((contractMethod: ContractMethod) => {
            tokensToTest.forEach(pair => {
              describe(`${contractMethod}`, () => {
                it(`${pair[0].symbol} -> ${pair[1].symbol}`, async () => {
                  await testE2E(
                    tokens[pair[0].symbol],
                    tokens[pair[1].symbol],
                    holders[pair[0].symbol],
                    side === SwapSide.SELL ? pair[0].amount : pair[1].amount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
              });
            });
          }),
        );
        it('simpleSwap DAI -> USDT', async () => {
          await testE2E(
            tokens['DAI'],
            tokens['USDT'],
            holders['DAI'],
            '100000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('USDC -> DAI', async () => {
          await testE2E(
            tokens['USDC'],
            tokens['DAI'],
            holders['USDC'],
            '100000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('DAI -> GUSD', async () => {
          await testE2E(
            tokens['DAI'],
            tokens['GUSD'],
            holders['DAI'],
            '100000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
            null,
            undefined,
            undefined,
            1000,
          );
        });

        describe('FeeOnTransfer', () => {
          describe('sell', () => {
            const contractMethod = ContractMethod.megaSwap;
            it('stETH -> ETH', async () => {
              await testE2E(
                tokens['STETH'],
                tokens['ETH'],
                holders['STETH'],
                '1000000000000000000',
                SwapSide.SELL,
                dexKey,
                contractMethod,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 1, destFee: 0, srcDexFee: 1, destDexFee: 0 },
              );
            });

            it('ETH -> stETH', async () => {
              await testE2E(
                tokens['ETH'],
                tokens['STETH'],
                holders['ETH'],
                '1000000000000000000',
                SwapSide.SELL,
                dexKey,
                contractMethod,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 1, srcDexFee: 0, destDexFee: 1 },
              );
            });
          });
        });
      });

      describe('MaverickV1', () => {
        const dexKey = 'MaverickV1';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );

        it('USDC -> DAI', async () => {
          await testE2E(
            tokens['USDC'],
            tokens['DAI'],
            holders['USDC'],
            '100000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('ETH -> USDC', async () => {
          await testE2E(
            tokens['ETH'],
            tokens['USDC'],
            holders['ETH'],
            '1000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('USDC -> ETH', async () => {
          await testE2E(
            tokens['USDC'],
            tokens['ETH'],
            holders['USDC'],
            '100000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('AaveV3', () => {
        const dexKey = 'AaveV3';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );

        it('USDC -> aEthUSDC', async () => {
          await testE2E(
            tokens['USDC'],
            tokens['aEthUSDC'],
            holders['USDC'],
            '1000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('ETH -> aEthWETH', async () => {
          await testE2E(
            tokens['ETH'],
            tokens['aEthWETH'],
            holders['ETH'],
            '300000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('aEthWETH -> ETH', async () => {
          await testE2E(
            tokens['aEthWETH'],
            tokens['ETH'],
            holders['aEthWETH'],
            '300000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });
    });

    describe('MutliSwap', () => {
      describe('MaverickV1', () => {
        describe('DAI -> USDC -> MAV via MaverickV1', () => {
          const dexKeys = ['MaverickV1'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'DAI';
          const tokenBSymbol: string = 'MAV';

          const tokenAAmount: string = '100000000000000000000';

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

        describe('ETH -> USDC -> MAV via MaverickV1', () => {
          const dexKeys = ['MaverickV1'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'ETH';
          const tokenBSymbol: string = 'MAV';

          const tokenAAmount: string = '1500000000000000000';

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

        describe('DAI -> USDC -> ETH via MaverickV1', () => {
          const dexKeys = ['MaverickV1'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'DAI';
          const tokenBSymbol: string = 'ETH';

          const tokenAAmount: string = '15000000000000000000';

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

      describe('SushiSwapV3', () => {
        describe('USDC -> ETH -> WBTC via SushiSwapV3', () => {
          const dexKeys = ['SushiSwapV3'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'USDC';
          const tokenBSymbol: string = 'WBTC';

          const tokenAAmount: string = '10000000';

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

        describe('USDT -> USDC -> ETH  via SushiSwapV3', () => {
          const dexKeys = ['SushiSwapV3'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'USDT';
          const tokenBSymbol: string = 'ETH';

          const tokenAAmount: string = '1000000000';

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

        describe('ETH -> USDC -> DAI  via SushiSwapV3', () => {
          const dexKeys = ['SushiSwapV3'];
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

        describe('USDT -> USDC -> DAI  via SushiSwapV3', () => {
          const dexKeys = ['SushiSwapV3'];
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
      });

      describe('BalancerV2', () => {
        describe('WBTC -> ETH -> BAL via BalancerV2', () => {
          const dexKeys = ['BalancerV2'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'WBTC';
          const tokenBSymbol: string = 'BAL';

          const tokenAAmount: string = '500000000';

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

        describe('USDC -> DAI -> USDT via BalancerV2', () => {
          const dexKeys = ['BalancerV2'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'USDC';
          const tokenBSymbol: string = 'USDT';

          const tokenAAmount: string = '50000000000';

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
              false,
              [
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
                '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
                '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
              ],
            );
          });
        });

        describe('ETH -> USDC -> DAI via BalancerV2', () => {
          const dexKeys = ['BalancerV2'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'ETH';
          const tokenBSymbol: string = 'DAI';

          const tokenAAmount: string = '1000000000000000000';

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
              false,
              [
                '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
                '0x6b175474e89094c44da98b954eedeac495271d0f', // BAL
              ],
            );
          });
        });
      });

      describe('Dex combinations', () => {
        describe('GUSD -> USDC -> ETH via SushiSwapV3 and CurveV1', () => {
          const dexKeys = ['SushiSwapV3', 'CurveV1'];
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

        describe('ETH -> USDC -> GUSD via SushiSwapV3 and CurveV1', () => {
          const dexKeys = ['SushiSwapV3', 'CurveV1'];
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

        describe('ETH -> USDC -> GUSD via BalancerV1 and CurveV1', () => {
          const dexKeys = ['BalancerV1', 'CurveV1'];
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

        describe('TUSD -> DAI -> GUSD via BalancerV1 and CurveV1', () => {
          const dexKeys = ['CurveV1'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'TUSD';
          const tokenBSymbol: string = 'GUSD';

          const tokenAAmount: string = '100000000000000000000';

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

        describe('WBTC -> ETH -> SUSHI via BalancerV1 and SushiSwapV3', () => {
          const dexKeys = ['BalancerV1', 'SushiSwapV3'];
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
    });
  });
});
