import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { JsonRpcProvider } from '@ethersproject/providers';

describe('UniswapV2 E2E', () => {
  describe('UniswapV2', () => {
    const dexKey = 'UniswapV2';
    const network = Network.MAINNET;
    const tokens = Tokens[Network.MAINNET];
    const holders = Holders[Network.MAINNET];
    const provider = new JsonRpcProvider(ProviderURL[network]);
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
          tokens['WBTC'],
          tokens['BADGER'],
          holders['WBTC'],
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
          tokens['WBTC'],
          holders['ETH'],
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens['BADGER'],
          tokens['ETH'],
          holders['BADGER'],
          '700000000000000000000',
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
          tokens['WBTC'],
          holders['USDC'],
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('swapOnUniswap', () => {
      it('ETH -> TOKEN swapOnUniswap', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['WBTC'],
          holders['ETH'],
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN[BADGER] -> ETH swapOnUniswap', async () => {
        await testE2E(
          tokens['BADGER'],
          tokens['ETH'],
          holders['BADGER'],
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH swapOnUniswap', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN swapOnUniswap', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
    });

    describe('swapOnUniswapFork', () => {
      it('ETH -> TOKEN swapOnUniswapFork', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['WBTC'],
          holders['ETH'],
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH swapOnUniswapFork', async () => {
        await testE2E(
          tokens['BADGER'],
          tokens['ETH'],
          holders['BADGER'],
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN swapOnUniswapFork', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
    });

    describe('buyOnUniswap', () => {
      it('TOKEN -> ETH buyOnUniswap', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['ETH'],
          holders['USDT'],
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER] buyOnUniswap', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['BADGER'],
          holders['ETH'],
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH buyOnUniswap', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN buyOnUniswap', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
          '200000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('TOKEN -> ETH simpleBuy', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['ETH'],
          holders['USDT'],
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER] simpleBuy', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['BADGER'],
          holders['ETH'],
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH simpleBuy', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN simpleBuy', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
          '20000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('BuyMethod', () => {
      it('TOKEN -> ETH buy', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['ETH'],
          holders['USDT'],
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER] buy', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['BADGER'],
          holders['ETH'],
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH buy', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN buy', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
          '20000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });

    describe('STETH->ETH', () => {
      it('simpleSwap', async () => {
        await testE2E(
          tokens['STETH'],
          tokens['ETH'],
          holders['STETH'],
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('multiSwap', async () => {
        await testE2E(
          tokens['STETH'],
          tokens['ETH'],
          holders['STETH'],
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('megaSwap', async () => {
        await testE2E(
          tokens['STETH'],
          tokens['ETH'],
          holders['STETH'],
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });
});
