import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('UniswapV2 E2E Optimism', () => {
  const network = Network.OPTIMISM;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('ZipSwap', () => {
    const dexKey = 'ZipSwap';

    describe('Simpleswap', () => {
      it('ZipSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDC,
          holders.ETH,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.DAI,
          tokens.ETH,
          holders.DAI,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WETH,
          tokens.USDC,
          holders.WETH,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('ZipSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDC,
          holders.ETH,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.DAI,
          tokens.ETH,
          holders.DAI,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WETH,
          holders.DAI,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('SimpleBuy', () => {
      it('ZipSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDC,
          holders.ETH,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.DAI,
          tokens.ETH,
          holders.DAI,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WETH,
          holders.DAI,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('BuyMethod', () => {
      it('ZipSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDC,
          holders.ETH,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.DAI,
          tokens.ETH,
          holders.DAI,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('ZipSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WETH,
          holders.DAI,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });
  });
});
