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

describe('UniswapV2 E2E Mainnet', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new JsonRpcProvider(ProviderURL[network]);

  describe('UniswapV2', () => {
    const dexKey = 'UniswapV2';

    describe('Simpleswap', () => {
      it('ETH -> TOKEN', async () => {
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
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
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
          tokens.WBTC,
          tokens.BADGER,
          holders.WBTC,
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
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
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
          tokens.BADGER,
          tokens.ETH,
          holders.BADGER,
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
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
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
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN[BADGER] -> ETH', async () => {
        await testE2E(
          tokens.BADGER,
          tokens.ETH,
          holders.BADGER,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
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
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.BADGER,
          tokens.ETH,
          holders.BADGER,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
    });

    describe('swapOnUniswapV2Fork', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapV2Fork,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.BADGER,
          tokens.ETH,
          holders.BADGER,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapV2Fork,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapV2Fork,
          network,
          provider,
        );
      });
    });

    describe('buyOnUniswap', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER]', async () => {
        await testE2E(
          tokens.ETH,
          tokens.BADGER,
          holders.ETH,
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });

      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswap,
          network,
          provider,
        );
      });
    });

    describe('buyOnUniswapFork', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapFork,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER]', async () => {
        await testE2E(
          tokens.ETH,
          tokens.BADGER,
          holders.ETH,
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapFork,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapFork,
          network,
          provider,
        );
      });

      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapFork,
          network,
          provider,
        );
      });
    });

    describe('buyOnUniswapV2Fork', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapV2Fork,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER]', async () => {
        await testE2E(
          tokens.ETH,
          tokens.BADGER,
          holders.ETH,
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapV2Fork,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapV2Fork,
          network,
          provider,
        );
      });

      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buyOnUniswapV2Fork,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER]', async () => {
        await testE2E(
          tokens.ETH,
          tokens.BADGER,
          holders.ETH,
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
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
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '700000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN[BADGER]', async () => {
        await testE2E(
          tokens.ETH,
          tokens.BADGER,
          holders.ETH,
          '700000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('TOKEN[USDC] -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
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
          tokens.STETH,
          tokens.ETH,
          holders.STETH,
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
          tokens.STETH,
          tokens.ETH,
          holders.STETH,
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
          tokens.STETH,
          tokens.ETH,
          holders.STETH,
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
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('SushiSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.BADGER,
          holders.WBTC,
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
      it('SushiSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('SushiSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.BADGER,
          tokens.ETH,
          holders.BADGER,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('SushiSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('swapOnUniswapFork', () => {
      it('SushiSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('SushiSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.BADGER,
          tokens.ETH,
          holders.BADGER,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('SushiSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
    });
  });

  describe('DefiSwap', () => {
    const dexKey = 'DefiSwap';

    describe('Simpleswap', () => {
      it('DefiSwap ETH -> TOKEN', async () => {
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
      it('DefiSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDC,
          tokens.ETH,
          holders.USDC,
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('DefiSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.renBTC,
          holders.WBTC,
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
      it('DefiSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('DefiSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.LINK,
          tokens.ETH,
          holders.LINK,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('DefiSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('swapOnUniswapFork', () => {
      it('DefiSwap ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.WBTC,
          holders.ETH,
          '7000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('DefiSwap TOKEN -> ETH', async () => {
        await testE2E(
          tokens.LINK,
          tokens.ETH,
          holders.LINK,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
      it('DefiSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WBTC,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapOnUniswapFork,
          network,
          provider,
        );
      });
    });
  });

  describe('ShibaSwap', () => {
    const dexKey = 'ShibaSwap';

    describe('Simpleswap', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '1000000000000000000',
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
          tokens.USDT,
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
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '10000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '10000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '20000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
          holders.USDC,
          '200000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('MegaSwap', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '10000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
          holders.USDC,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('SakeSwap', () => {
    const dexKey = 'SakeSwap';

    describe('Simpleswap', () => {
      // http://localhost:3333/v2/prices/?from=0xdac17f958d2ee523a2206206994597c13d831ec7&to=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amount=200000000&includeDEXS=SakeSwap&side=SELL&network=1
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000000000000000&includeDEXS=SakeSwap&side=SELL&network=1
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0x2260fac5e5542a773aa44fbcfedf7c193bc2c599&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000&includeDEXS=SakeSwap&side=SELL&network=1
        await testE2E(
          tokens.WBTC,
          tokens.USDT,
          holders.WBTC,
          '1000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('SimpleBuy', () => {
      // http://localhost:3333/v2/prices/?from=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&to=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amount=2000000000&includeDEXS=SakeSwap&side=BUY&network=1
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.LINK,
          tokens.ETH,
          holders.LINK,
          '2000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000&includeDEXS=SakeSwap&side=BUY&network=1
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '1000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0x2260fac5e5542a773aa44fbcfedf7c193bc2c599&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=100000&includeDEXS=SakeSwap&side=BUY&network=1
        await testE2E(
          tokens.WBTC,
          tokens.USDT,
          holders.WBTC,
          '100000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('Multiswap', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.USDT,
          holders.WBTC,
          '1000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('MegaPath', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens.USDT,
          tokens.ETH,
          holders.USDT,
          '200000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens.ETH,
          tokens.USDT,
          holders.ETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.USDT,
          holders.WBTC,
          '1000000',
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
