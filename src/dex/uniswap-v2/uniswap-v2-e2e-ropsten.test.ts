import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('UniswapV2 E2E Ropsten', () => {
  const dexKey = 'UniswapV2';
  const network = Network.ROPSTEN;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('SimpleSwap', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '400000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
  });

  describe('MultiSwap', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '400000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });
  });

  describe('MegaSwap', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.megaSwap,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '400000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.megaSwap,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.megaSwap,
        network,
        provider,
      );
    });
  });

  describe('SimpleBuy', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
  });

  describe('BuyMethod', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
  });

  describe('DirectSwapOnUniswap', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswap,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '400000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswap,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswap,
        network,
        provider,
      );
    });
  });

  describe('DirectSwapOnUniswapFork', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswapFork,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '400000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswapFork,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswapFork,
        network,
        provider,
      );
    });
  });

  describe('DirectBuyOnUniswap', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswap,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswap,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswap,
        network,
        provider,
      );
    });
  });

  describe('DirectBuyOnUniswapFork', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswapFork,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswapFork,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswapFork,
        network,
        provider,
      );
    });
  });

  describe('DirectSwapOnUniswapV2Fork', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswapV2Fork,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '400000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswapV2Fork,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.swapOnUniswapV2Fork,
        network,
        provider,
      );
    });
  });

  describe('DirectBuyOnUniswapV2Fork', () => {
    it('ETH -> TOKEN', async () => {
      await testE2E(
        tokens.ETH,
        tokens.DAI,
        holders.ETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswapV2Fork,
        network,
        provider,
      );
    });
    it('TOKEN -> ETH', async () => {
      await testE2E(
        tokens.DAI,
        tokens.ETH,
        holders.DAI,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswapV2Fork,
        network,
        provider,
      );
    });
    it('TOKEN -> TOKEN', async () => {
      await testE2E(
        tokens.WETH,
        tokens.DAI,
        holders.WETH,
        '400000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buyOnUniswapV2Fork,
        network,
        provider,
      );
    });
  });
});
