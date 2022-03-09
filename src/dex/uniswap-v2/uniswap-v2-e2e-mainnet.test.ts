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

jest.setTimeout(30000);

describe('UniswapV2 E2E Mainnet', () => {
  it('50WETH -> ALPHA', async () => {
    await doTest(
      WETH,
      ALPHA,
      holders[WETH],
      '50000000000000000000',
      SwapSide.SELL,
      undefined,
      undefined,
    );
  });

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
      it('ETH -> TOKEN', async () => {
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
      it('TOKEN[BADGER] -> ETH', async () => {
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
      it('TOKEN[USDC] -> ETH', async () => {
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
      it('TOKEN -> TOKEN', async () => {
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
      it('ETH -> TOKEN', async () => {
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
      it('TOKEN -> ETH', async () => {
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
      it('TOKEN -> TOKEN', async () => {
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

    describe('swapOnUniswapV2Fork', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['WBTC'],
          holders['ETH'],
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
          tokens['BADGER'],
          tokens['ETH'],
          holders['BADGER'],
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
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
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
      it('ETH -> TOKEN[BADGER]', async () => {
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
      it('TOKEN[USDC] -> ETH', async () => {
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

      it('TOKEN -> TOKEN', async () => {
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

    describe('buyOnUniswapFork', () => {
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['ETH'],
          holders['USDT'],
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
          tokens['ETH'],
          tokens['BADGER'],
          holders['ETH'],
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
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
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
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
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
          tokens['USDT'],
          tokens['ETH'],
          holders['USDT'],
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
          tokens['ETH'],
          tokens['BADGER'],
          holders['ETH'],
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
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
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
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
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
      it('ETH -> TOKEN[BADGER]', async () => {
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
      it('TOKEN[USDC] -> ETH', async () => {
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
      it('TOKEN -> TOKEN', async () => {
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
      it('TOKEN -> ETH', async () => {
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
      it('ETH -> TOKEN[BADGER]', async () => {
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
      it('TOKEN[USDC] -> ETH', async () => {
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
      it('TOKEN -> TOKEN', async () => {
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

  describe('ContractMethod: MegaPath', () => {
    it('1000 ETH -> DAI', async () => {
      await doTest(
        ETH,
        DAI,
        holders[ETH],
        '1000000000000000000000',
        SwapSide.SELL,
        'UniswapV2,SushiSwap,LinkSwap',
        [ContractMethod.megaSwap],
      );
    });

    it('1000 ETH -> DAI UniswapForks', async () => {
      await doTest(
        ETH,
        DAI,
        holders[ETH],
        '1000000000000000000000',
        SwapSide.SELL,
        'UniswapV2,SushiSwap,LinkSwap',
        [ContractMethod.megaSwap],
        undefined,
        undefined,
        undefined,
      );
    });

    it('1000 ETH -> DAI', async () => {
      await doTest(
        ETH,
        DAI,
        holders[ETH],
        '1000000000000000000000',
        SwapSide.SELL,
        undefined,
        [ContractMethod.megaSwap],
      );
    });

    it('50 WBTC -> LINK', async () => {
      await doTest(
        WBTC,
        LINK,
        holders[WBTC],
        '500000000',
        SwapSide.SELL,
        undefined,
        [ContractMethod.megaSwap],
      );
    });

    it('1M USDT -> ETH', async () => {
      await doTest(
        USDT,
        ETH,
        holders[USDT],
        '1000000000000',
        SwapSide.SELL,
        undefined,
        [ContractMethod.megaSwap],
      );
    });
  });

  describe('ContractMethod: BuyMethod', () => {
    it('ETH -> DAI buy 100000', async () => {
      await doTest(
        ETH,
        DAI,
        holders[ETH],
        '100000000000000000000000',
        SwapSide.BUY,
        undefined,
        [ContractMethod.buy],
      );
    });

    it('WBTC -> DAI buy 100000', async () => {
      await doTest(
        WBTC,
        DAI,
        holders[WBTC],
        '100000000000000000000000',
        SwapSide.BUY,
        undefined,
        [ContractMethod.buy],
      );
    });

    it('WBTC -> ETH buy 10', async () => {
      await doTest(
        WBTC,
        ETH,
        holders[WBTC],
        '10000000000000000000',
        SwapSide.BUY,
        undefined,
        [ContractMethod.buy],
      );
    });
  });

  describe('Multiswap Edge Cases', () => {
    it('Balancer TOKEN -> BAL', async () => {
      await doTest(
        USDC,
        BAL,
        holders[USDC],
        '5000000000',
        SwapSide.SELL,
        undefined,
        [ContractMethod.multiSwap],
      );
    });

    it('DODOV1 DODO -> TOKEN', async () => {
      await doTest(
        DODO,
        USDC,
        holders[DODO],
        '1333000000000000000000',
        SwapSide.SELL,
        undefined,
        [ContractMethod.multiSwap],
      );
    });
  });

  describe('SushiSwap', () => {
    describe('Simpleswap', () => {
      it('SushiSwap ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDC,
          holders[ETH],
          '7000000000000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.simpleSwap],
        );
      });
      it('SushiSwap TOKEN -> ETH', async () => {
        await doTest(
          USDC,
          ETH,
          holders[USDC],
          '2000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.simpleSwap],
        );
      });
      it('SushiSwap TOKEN -> TOKEN', async () => {
        await doTest(
          WBTC,
          BADGER,
          holders[WBTC],
          '20000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.simpleSwap],
        );
      });
    });

    describe('Multiswap', () => {
      it('SushiSwap ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          WBTC,
          holders[ETH],
          '7000000000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.multiSwap],
        );
      });
      it('SushiSwap TOKEN -> ETH', async () => {
        await doTest(
          BADGER,
          ETH,
          holders[BADGER],
          '700000000000000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.multiSwap],
        );
      });
      it('SushiSwap TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          WBTC,
          holders[USDC],
          '200000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.multiSwap],
        );
      });
    });

    describe('swapOnUniswapFork', () => {
      it('SushiSwap ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          WBTC,
          holders[ETH],
          '7000000000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.swapOnUniswapFork],
        );
      });
      it('SushiSwap TOKEN -> ETH', async () => {
        await doTest(
          BADGER,
          ETH,
          holders[BADGER],
          '700000000000000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.swapOnUniswapFork],
        );
      });
      it('SushiSwap TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          WBTC,
          holders[USDC],
          '200000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.swapOnUniswapFork],
        );
      });
    });
  });

  describe('DefiSwap', () => {
    describe('Simpleswap', () => {
      it('DefiSwap ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDC,
          holders[ETH],
          '7000000000000000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.simpleSwap],
        );
      });
      it('DefiSwap TOKEN -> ETH', async () => {
        await doTest(
          USDC,
          ETH,
          holders[USDC],
          '2000000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.simpleSwap],
        );
      });
      it('DefiSwap TOKEN -> TOKEN', async () => {
        await doTest(
          WBTC,
          renBTC,
          holders[WBTC],
          '20000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.simpleSwap],
        );
      });
    });

    describe('Multiswap', () => {
      it('DefiSwap ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          WBTC,
          holders[ETH],
          '7000000000000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.multiSwap],
        );
      });
      it('DefiSwap TOKEN -> ETH', async () => {
        await doTest(
          LINK,
          ETH,
          holders[LINK],
          '700000000000000000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.multiSwap],
        );
      });
      it('DefiSwap TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          WBTC,
          holders[USDC],
          '200000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.multiSwap],
        );
      });
    });

    describe('swapOnUniswapFork', () => {
      it('DefiSwap ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          WBTC,
          holders[ETH],
          '7000000000000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.swapOnUniswapFork],
        );
      });
      it('DefiSwap TOKEN -> ETH', async () => {
        await doTest(
          LINK,
          ETH,
          holders[LINK],
          '700000000000000000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.swapOnUniswapFork],
        );
      });
      it('DefiSwap TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          WBTC,
          holders[USDC],
          '200000000',
          SwapSide.SELL,
          'DefiSwap',
          [ContractMethod.swapOnUniswapFork],
        );
      });
    });
  });

  describe('ShibaSwap', () => {
    describe('Simpleswap', () => {
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '20000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.simpleSwap],
        );
      });
      it('ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.simpleSwap],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          WETH,
          USDT,
          holders[WETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.simpleSwap],
        );
      });
    });
    describe('MultiSwap', () => {
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '20000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.multiSwap],
        );
      });
      it('ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '10000000000000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.multiSwap],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          USDT,
          holders[USDC],
          '200000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.multiSwap],
        );
      });
    });
    describe('SimpleBuy', () => {
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '10000000000000000',
          SwapSide.BUY,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.simpleBuy],
        );
      });
      it('ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '20000000',
          SwapSide.BUY,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.simpleBuy],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          USDT,
          holders[USDC],
          '200000000',
          SwapSide.BUY,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.simpleBuy],
        );
      });
    });
    describe('MegaSwap', () => {
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '20000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.megaSwap],
        );
      });
      it('ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '10000000000000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.megaSwap],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          USDC,
          USDT,
          holders[USDC],
          '200000000',
          SwapSide.SELL,
          EXCHANGES.SHIBASWAP,
          [ContractMethod.megaSwap],
        );
      });
    });
  });

  describe('SakeSwap', () => {
    describe('Simpleswap', () => {
      // http://localhost:3333/v2/prices/?from=0xdac17f958d2ee523a2206206994597c13d831ec7&to=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amount=200000000&includeDEXS=SakeSwap&side=SELL&network=1
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '200000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.simpleSwap],
        );
      });
      it('ETH -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000000000000000&includeDEXS=SakeSwap&side=SELL&network=1
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.simpleSwap],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0x2260fac5e5542a773aa44fbcfedf7c193bc2c599&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000&includeDEXS=SakeSwap&side=SELL&network=1
        await doTest(
          WBTC,
          USDT,
          holders[WBTC],
          '1000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.simpleSwap],
        );
      });
    });
    describe('SimpleBuy', () => {
      // http://localhost:3333/v2/prices/?from=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&to=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amount=2000000000&includeDEXS=SakeSwap&side=BUY&network=1
      it('TOKEN -> ETH', async () => {
        await doTest(
          LINK,
          ETH,
          holders[LINK],
          '2000000000',
          SwapSide.BUY,
          EXCHANGES.SAKESWAP,
          [ContractMethod.simpleBuy],
        );
      });
      it('ETH -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000&includeDEXS=SakeSwap&side=BUY&network=1
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '1000000',
          SwapSide.BUY,
          EXCHANGES.SAKESWAP,
          [ContractMethod.simpleBuy],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        // http://localhost:3333/v2/prices/?from=0x2260fac5e5542a773aa44fbcfedf7c193bc2c599&to=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=100000&includeDEXS=SakeSwap&side=BUY&network=1
        await doTest(
          WBTC,
          USDT,
          holders[WBTC],
          '100000',
          SwapSide.BUY,
          EXCHANGES.SAKESWAP,
          [ContractMethod.simpleBuy],
        );
      });
    });
    describe('Multiswap', () => {
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '200000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.multiSwap],
        );
      });
      it('ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.multiSwap],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          WBTC,
          USDT,
          holders[WBTC],
          '1000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.multiSwap],
        );
      });
    });
    describe('MegaPath', () => {
      it('TOKEN -> ETH', async () => {
        await doTest(
          USDT,
          ETH,
          holders[USDT],
          '200000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.megaSwap],
        );
      });
      it('ETH -> TOKEN', async () => {
        await doTest(
          ETH,
          USDT,
          holders[ETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.megaSwap],
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          WBTC,
          USDT,
          holders[WBTC],
          '1000000',
          SwapSide.SELL,
          EXCHANGES.SAKESWAP,
          [ContractMethod.megaSwap],
        );
      });
    });
  });
});
