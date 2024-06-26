import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../tests/utils-e2e';
import { Holders, NativeTokenSymbols, Tokens } from '../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../config';
import { OptimalRate } from '../types';

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
  describe('Mainnet', () => {
    const network = Network.MAINNET;

    describe('SimpleSwap', () => {
      describe('AngleStakedStableUSD', () => {
        const dexKey = 'AngleStakedStableUSD';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );

        it('SimpleSwap stUSD -> USDA', async () => {
          await testE2E(
            tokens['stUSD'],
            tokens['USDA'],
            holders['stUSD'],
            '1000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

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

        it('simpleSwap USDC -> ETH', async () => {
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

      describe('Etherfi', () => {
        const dexKey = 'EtherFi';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );

        it('simpleSwap eETH -> weETH', async () => {
          await testE2E(
            tokens['eETH'],
            tokens['weETH'],
            holders['eETH'],
            '100000000000000000',
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

        describe('PSP -> ETH -> stETH', () => {
          const dexKeys = ['SushiSwap', 'Lido'];
          const provider = new StaticJsonRpcProvider(
            generateConfig(network).privateHttpProvider,
            network,
          );
          const slippage = undefined;

          const tokenASymbol: string = 'PSP';
          const tokenBSymbol: string = 'STETH';

          const tokenAAmount: string = '3396186773559304606863';

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
              undefined,
              [
                '0xcafe001067cdef266afb7eb5a286dcfd277f3de5', // PSP
                '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
                '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', // stETH
              ],
            );
          });
        });
      });
    });
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;

    describe('SimpleSwap', () => {
      describe('Dfyn', () => {
        const dexKey = 'Dfyn';

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'WBTC';

        const tokenAAmount: string = '10000000';
        const tokenBAmount: string = '10000000';
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

    describe('MultiSwap', () => {
      describe('USDC.e -> MATIC -> CRV via Dystopia and QuickSwap', () => {
        const dexKeys = ['Dystopia', 'QuickSwap'];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const slippage = undefined;

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'CRV';

        const tokenAAmount: string = '4439351';

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

      // describe('MATIC -> ETH -> SUSHI via Dfyn and SushiV3', () => {
      //   const dexKeys = ['Dfyn', 'SushiSwapV3'];
      //   const provider = new StaticJsonRpcProvider(
      //     generateConfig(network).privateHttpProvider,
      //     network,
      //   );
      //   const slippage = undefined;
      //
      //   const tokenASymbol: string = 'MATIC';
      //   const tokenBSymbol: string = 'SUSHI';
      //
      //   const tokenAAmount: string = '10000000000000000000';
      //
      //   const tokens = Tokens[network];
      //   const holders = Holders[network];
      //   const contractMethod = ContractMethod.multiSwap;
      //   const side = SwapSide.SELL;
      //
      //   it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
      //     await testE2E(
      //       tokens[tokenASymbol],
      //       tokens[tokenBSymbol],
      //       holders[tokenASymbol],
      //       tokenAAmount,
      //       side,
      //       dexKeys,
      //       contractMethod,
      //       network,
      //       provider,
      //       undefined,
      //       undefined,
      //       undefined,
      //       slippage,
      //       2000,
      //     );
      //   });
      // });
    });
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    describe('MultiSwap', () => {
      describe('USDC -> ETH -> sETH', () => {
        const dexKeys = ['UniswapV3', 'CurveV1Factory'];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const slippage = undefined;

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'sETH';

        const tokenAAmount: string = '1617000000';

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

  // describe('Arbitrum', () => {
  //   const network = Network.ARBITRUM;
  //   describe('MultiSwap', () => {
  // const priceRoute = {
  //   blockNumber: 184603981,
  //   network: 42161,
  //   srcToken: '0x8b0e6f19ee57089f7649a455d89d7bc6314d04e8',
  //   srcDecimals: 18,
  //   srcAmount: '10000000000000000000',
  //   destToken: '0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8',
  //   destDecimals: 18,
  //   destAmount: '58376015865102035852',
  //   bestRoute: [
  //     {
  //       percent: 100,
  //       swaps: [
  //         {
  //           srcToken: '0x8b0e6f19ee57089f7649a455d89d7bc6314d04e8',
  //           srcDecimals: 18,
  //           destToken: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  //           destDecimals: 6,
  //           swapExchanges: [
  //             {
  //               exchange: 'Camelot',
  //               srcAmount: '10000000000000000000',
  //               destAmount: '160519565',
  //               percent: 100,
  //               poolAddresses: ['0x410c879c62f22794bD5eE98e2EE01490F6d47A6b'],
  //               data: {
  //                 router: '0x1Be46c7A40906c19d91d07B3AE69Ef5893268F25',
  //                 path: [
  //                   '0x8b0e6f19ee57089f7649a455d89d7bc6314d04e8',
  //                   '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  //                 ],
  //                 factory: '0x6EcCab422D763aC031210895C81787E87B43A652',
  //                 initCode:
  //                   '0xa856464ae65f7619087bc369daaf7e387dae1e5af69cfa7935850ebf754b04c1',
  //                 feeFactor: 100000,
  //                 isFeeTokenInRoute: false,
  //                 pools: [
  //                   {
  //                     address: '0x410c879c62f22794bD5eE98e2EE01490F6d47A6b',
  //                     fee: 500,
  //                     direction: true,
  //                   },
  //                 ],
  //                 gasUSD: '0.323201',
  //               },
  //             },
  //           ],
  //         },
  //         {
  //           srcToken: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  //           srcDecimals: 6,
  //           destToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  //           destDecimals: 18,
  //           swapExchanges: [
  //             {
  //               exchange: 'Camelot',
  //               srcAmount: '160519565',
  //               destAmount: '51771474390335981',
  //               percent: 100,
  //               poolAddresses: ['0x84652bb2539513BAf36e225c930Fdd8eaa63CE27'],
  //               data: {
  //                 router: '0x1Be46c7A40906c19d91d07B3AE69Ef5893268F25',
  //                 path: [
  //                   '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  //                   '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  //                 ],
  //                 factory: '0x6EcCab422D763aC031210895C81787E87B43A652',
  //                 initCode:
  //                   '0xa856464ae65f7619087bc369daaf7e387dae1e5af69cfa7935850ebf754b04c1',
  //                 feeFactor: 100000,
  //                 isFeeTokenInRoute: false,
  //                 pools: [
  //                   {
  //                     address: '0x84652bb2539513BAf36e225c930Fdd8eaa63CE27',
  //                     fee: 300,
  //                     direction: false,
  //                   },
  //                 ],
  //                 gasUSD: '0.323201',
  //               },
  //             },
  //           ],
  //         },
  //         {
  //           srcToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  //           srcDecimals: 18,
  //           destToken: '0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8',
  //           destDecimals: 18,
  //           swapExchanges: [
  //             {
  //               exchange: 'CamelotV3',
  //               srcAmount: '51771474390335981',
  //               destAmount: '58376015865102035852',
  //               percent: 100,
  //               poolAddresses: ['0xe461f84c3fe6bcdd1162eb0ef4284f3bb6e4cad3'],
  //               data: {
  //                 feeOnTransfer: false,
  //                 path: [
  //                   {
  //                     tokenIn: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  //                     tokenOut: '0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8',
  //                   },
  //                 ],
  //                 gasUSD: '0.290559',
  //               },
  //             },
  //           ],
  //         },
  //       ],
  //     },
  //   ],
  //   gasCostUSD: '1.757908',
  //   gasCost: '598300',
  //   others: [],
  //   side: 'SELL',
  //   tokenTransferProxy: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
  //   contractAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
  //   contractMethod: 'multiSwap',
  //   partnerFee: 0,
  //   srcUSD: '160.9000000000',
  //   destUSD: '159.3665233117',
  //   partner: 'Camelot',
  //   maxImpactReached: false,
  //   hmac: 'c53e8a540a60a7d05aa50865d306f8d5458243a1',
  // } as unknown as OptimalRate;
  //     describe('DMT-> USDC.e -> WETH -> PENDLE via Camelot and CamelotV3', () => {
  //       const dexKeys = ['Camelot', 'CamelotV3'];
  //       const provider = new StaticJsonRpcProvider(
  //         generateConfig(network).privateHttpProvider,
  //         network,
  //       );
  //       const slippage = undefined;
  //
  //       const tokenASymbol: string = 'DMT';
  //       const tokenBSymbol: string = 'PENDLE';
  //
  //       const tokenAAmount: string = '10000000000000000000';
  //
  //       const tokens = Tokens[network];
  //       const holders = Holders[network];
  //       const contractMethod = ContractMethod.multiSwap;
  //       const side = SwapSide.SELL;
  //
  //       it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
  //         await testE2E(
  //           tokens[tokenASymbol],
  //           tokens[tokenBSymbol],
  //           holders[tokenASymbol],
  //           tokenAAmount,
  //           side,
  //           dexKeys,
  //           contractMethod,
  //           network,
  //           provider,
  //           undefined,
  //           undefined,
  //           undefined,
  //           slippage,
  //           2000,
  //         );
  //       });
  //     });
  //   });
  // });
});
