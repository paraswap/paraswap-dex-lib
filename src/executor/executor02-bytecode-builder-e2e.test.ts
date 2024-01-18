import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../tests/utils-e2e';
import { Holders, Tokens } from '../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../config';

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
        const tokenAAmount: string = '4000000000000000000';

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

      describe('SUSHI -> ETH via SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3'];

        const tokenASymbol: string = 'SUSHI';
        const tokenBSymbol: string = 'ETH';
        const tokenAAmount: string = '3000000000000000000000';

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
        const tokenAAmount: string = '11000000000000';

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

      describe('DAI -> ETH -> SUSHI via SushiSwapV3 and UniswapV3', () => {
        const dexKeys = ['SushiSwapV3', 'UniswapV3'];

        const tokenASymbol: string = 'DAI';
        const tokenBSymbol: string = 'SUSHI';
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
    });
  });
});
