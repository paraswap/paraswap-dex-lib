import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../tests/utils-e2e';
import { Holders, Tokens } from '../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../config';

jest.setTimeout(120000);
describe('Executor02ByteCodeBuilder e2e tests', () => {
  describe('MAINNET', () => {
    const network = Network.MAINNET;
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokens = Tokens[network];
    const holders = Holders[network];
    const slippage = undefined;

    describe('SimpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;

      describe('ETH -> SUSHI via SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'SUSHI';
        const tokenAAmount: string = '60000000000000000000';

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
            200,
            2000,
          );
        });
      });

      describe('SUSHI -> ETH via SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3'];

        const tokenASymbol: string = 'SUSHI';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '300000000000000000000000';

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

      describe('ETH -> USDC via SushiSwapV3 and BalancerV1', () => {
        const dexKeys = ['SushiSwapV3', 'BalancerV1'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '10000000000000000000';

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

      describe('USDC -> ETH via SushiSwapV3 and BalancerV1', () => {
        const dexKeys = ['SushiSwapV3', 'BalancerV1'];

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '20000000000';

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

      describe('USDT -> USDC via UniswapV3 and CurveV1', () => {
        const dexKeys = ['UniSwapV3', 'CurveV1'];

        const tokenASymbol: string = 'USDT';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '1100000000000';

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

      describe('ETH -> USDC via BalancerV2 and MaverickV1', () => {
        const dexKeys = ['MaverickV1', 'BalancerV2'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '3000000000000000000';

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

    describe('MultiSwap', () => {
      const contractMethod = ContractMethod.multiSwap;

      describe('WBTC -> ETH -> BAL via BalancerV2 and BalancerV1', () => {
        const dexKeys = ['BalancerV1', 'BalancerV2'];

        const tokenASymbol: string = 'WBTC';
        const tokenBSymbol: string = 'BAL';
        const tokenAAmount: string = '1000000000';

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
              '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
              '0xba100000625a3754423978a60c9317c58a424e3d', // BAL
            ],
          );
        });
      });

      describe('WBTC -> ETH -> SUSHI via SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3'];

        const tokenASymbol: string = 'WBTC';
        const tokenBSymbol: string = 'SUSHI';
        const tokenAAmount: string = '200000000';

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
              '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
              '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', // SUSHI
            ],
          );
        });
      });

      describe('SUSHI -> ETH -> WBTC via SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3'];

        const tokenASymbol: string = 'SUSHI';
        const tokenBSymbol: string = 'WBTC';
        const tokenAAmount: string = '1000000000000000000000000';

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
              '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', // SUSHI
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
              '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
            ],
          );
        });
      });

      describe('BAL -> ETH -> SUSHI via BalancerV1,SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3', 'BalancerV1'];

        const tokenASymbol: string = 'BAL';
        const tokenBSymbol: string = 'SUSHI';
        const tokenAAmount: string = '100000000000000000000000';

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
              '0xba100000625a3754423978a60c9317c58a424e3D', // BAL
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
              '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', // SUSHI
            ],
          );
        });
      });

      describe('ETH -> USDC -> MAV via MaverickV1,SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3', 'MaverickV1'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'MAV';
        const tokenAAmount: string = '100000000000000000000000';

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
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
              '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
              '0x7448c7456a97769f6cd04f1e83a4a23ccdc46abd', // MAV
            ],
          );
        });
      });

      describe('USDT -> DAI -> ETH via UniswapV3 on each path', () => {
        const dexKeys = ['UniswapV3'];

        const tokenASymbol: string = 'USDT';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '100000000000';

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
            300,
            2000,
            false,
            [
              '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
              '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
            ],
          );
        });
      });

      describe('DAI -> USDC -> ETH via UniswapV3 and CurveV1', () => {
        const dexKeys = ['UniswapV3', 'CurveV1'];

        const tokenASymbol: string = 'DAI';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '100000000000000000000000000';

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
            300,
            2000,
            false,
            [
              '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
              '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
              '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
            ],
          );
        });
      });
    });

    describe('MegaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;

      describe('WBTC -> USDC via UniswapV3', () => {
        const dexKeys = ['UniswapV3'];

        const tokenASymbol: string = 'WBTC';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '2500000000';

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

      describe('USDC -> ETH via UniswapV3', () => {
        const dexKeys = ['UniswapV3'];

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '10000000000000';

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
            300,
            2000,
          );
        });
      });

      describe('ETH -> USDC via UniswapV3', () => {
        const dexKeys = ['UniswapV3'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '10000000000000000000000';

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

      describe('DAI -> ETH via UniswapV3', () => {
        const dexKeys = ['UniswapV3'];

        const tokenASymbol: string = 'DAI';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '10000000000000000000000000';

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
            300,
            2000,
          );
        });
      });

      describe('ETH -> USDC via BalancerV2 and UniswapV3', () => {
        const dexKeys = ['UniswapV3', 'BalancerV2'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '10000000000000000000000';

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
            500,
            2000,
          );
        });
      });

      describe('WBTC -> DAI via UniswapV3', () => {
        const dexKeys = ['UniswapV3'];

        const tokenASymbol: string = 'WBTC';
        const tokenBSymbol: string = 'DAI';
        const tokenAAmount: string = '100000000000';

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
            undefined,
            2000,
          );
        });
      });

      describe('ETH -> DAI via BalancerV2 and MaverickV1', () => {
        const dexKeys = ['BalancerV2', 'MaverickV1'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'DAI';
        const tokenAAmount: string = '20000000000000000000';

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
            300,
            2000,
            false,
          );
        });
      });

      describe('ETH -> USDC via MaverickV1 and BalancerV2', () => {
        const dexKeys = ['BalancerV2', 'MaverickV1'];

        const tokenASymbol: string = 'ETH';
        const tokenBSymbol: string = 'USDC';
        const tokenAAmount: string = '50000000000000000000';

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
            300,
            2000,
            false,
          );
        });
      });

      describe('DAI -> ETH via SushiSwapV3,BalancerV1, BalancerV2 and CurveV1 ', () => {
        const dexKeys = ['SushiSwapV3', 'BalancerV1', 'BalancerV2', 'CurveV1'];

        const tokenASymbol: string = 'DAI';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '900000000000000000000000';

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
            300,
            2000,
            false,
          );
        });
      });
    });
  });
});
