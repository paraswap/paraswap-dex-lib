import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('UniswapV2 E2E Arbitrum', () => {
  const network = Network.ARBITRUM;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('SushiSwap', () => {
    const dexKey = 'SushiSwap';

    describe('Simpleswap', () => {
      it('SushiSwap ETH -> TOKEN', async () => {
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
      it('SushiSwap TOKEN -> ETH', async () => {
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
      it('SushiSwap TOKEN -> TOKEN', async () => {
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
      it('SushiSwap ETH -> TOKEN', async () => {
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
      it('SushiSwap TOKEN -> ETH', async () => {
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
      it('SushiSwap TOKEN -> TOKEN', async () => {
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
      it('SushiSwap ETH -> TOKEN', async () => {
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
      it('SushiSwap TOKEN -> ETH', async () => {
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
      it('SushiSwap TOKEN -> TOKEN', async () => {
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
      it('SushiSwap ETH -> TOKEN', async () => {
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
      it('SushiSwap TOKEN -> ETH', async () => {
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
      it('SushiSwap TOKEN -> TOKEN', async () => {
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

  describe('SwapFish', () => {
    const dexKey = 'SwapFish';

    describe('Simpleswap', () => {
      it('SwapFish TOKEN -> TOKEN', async () => {
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
      it('SwapFish TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WETH,
          tokens.USDC,
          holders.WETH,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });
});
