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

describe('UniswapV2 E2E BSC', () => {
  describe('Pancake Swap V2', () => {
    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          BUSD,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'pancakeswapv2',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          BUSD,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'pancakeswapv2',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('BuyMethod', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          BUSD,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.BUY,
          'pancakeswapv2',
          [ContractMethod.buy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Julswap', () => {
    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          BUSD,
          WBNB,
          holders[BUSD],
          '7000000000000000000',
          SwapSide.SELL,
          'julswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          BUSD,
          WBNB,
          holders[BUSD],
          '7000000000000000000',
          SwapSide.SELL,
          'julswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('ApeSwap V2', () => {
    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          BUSD,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          BUSD,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Pancake Swap', () => {
    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          WBNB,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'pancakeswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          WBNB,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'pancakeswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Bakery Swap', () => {
    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '70000000000000000000',
          SwapSide.SELL,
          'bakeryswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '70000000000000000000',
          SwapSide.SELL,
          'bakeryswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Street Swap', () => {
    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          WBNB,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'streetswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          WBNB,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'streetswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Panther Swap', () => {
    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '7000000000000000000',
          SwapSide.SELL,
          'pantherswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('TOKEN -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '70000000000000000000',
          SwapSide.SELL,
          'pantherswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('Token -> TOKEN', async () => {
        await doTest(
          BUSD,
          USDT,
          holders[BUSD],
          '70000000000000000000',
          SwapSide.SELL,
          'pantherswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          DAI,
          WBNB,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'pantherswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '7000000000000000000',
          SwapSide.SELL,
          'pantherswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('TOKEN -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '70000000000000000000',
          SwapSide.SELL,
          'pantherswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('MDEX', () => {
    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          USDT,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> BNB', async () => {
        await doTest(
          USDT,
          BNB,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe.skip('BUY', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          USDT,
          holders[BNB],
          '100000000000000000000',
          SwapSide.BUY,
          EXCHANGES.MDEX,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.BUY,
          EXCHANGES.MDEX,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '10000000000000000000',
          SwapSide.BUY,
          EXCHANGES.MDEX,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          USDT,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> BNB', async () => {
        await doTest(
          USDT,
          BNB,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Megapath', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MDEX,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Biswap', () => {
    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          USDT,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> BNB', async () => {
        await doTest(
          USDT,
          BNB,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe.skip('BUY', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          USDT,
          holders[BNB],
          '100000000000000000000',
          SwapSide.BUY,
          EXCHANGES.BISWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.BUY,
          EXCHANGES.BISWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '10000000000000000000',
          SwapSide.BUY,
          EXCHANGES.BISWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('BNB -> TOKEN', async () => {
        await doTest(
          BNB,
          USDT,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('Token -> BNB', async () => {
        await doTest(
          USDT,
          BNB,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('Megapath', () => {
      it('Token -> TOKEN', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('WaultFinanace', () => {
    describe('Simpleswap', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe.skip('SimpleBuy', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000000',
          SwapSide.BUY,
          'WaultFinance',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.BUY,
          'WaultFinance',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '100000000000000000000',
          SwapSide.BUY,
          'WaultFinance',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('MultiSwap', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('MegaSwap', () => {
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('CoinSwap', () => {
    describe('Simpleswap', () => {
      it('BUSD -> WBNB', async () => {
        await doTest(
          BUSD,
          WBNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe.skip('SimpleBuy', () => {
      it('BUSD -> WBNB', async () => {
        await doTest(
          BUSD,
          WBNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.BUY,
          EXCHANGES.COINSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.BUY,
          EXCHANGES.COINSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '1000000000000000000',
          SwapSide.BUY,
          EXCHANGES.COINSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });

    describe('MultiSwap', () => {
      it('BUSD -> WBNB', async () => {
        await doTest(
          BUSD,
          WBNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('MegaSwap', () => {
      it('BUSD -> WBNB', async () => {
        await doTest(
          BUSD,
          WBNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COINSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('JetSwap', () => {
    describe('Simpleswap', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe.skip('SimpleBuy', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000000',
          SwapSide.BUY,
          'JetSwap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.BUY,
          'JetSwap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '100000000000000000000',
          SwapSide.BUY,
          'JetSwap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('MultiSwap', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('MegaSwap', () => {
      it('USDT -> BUSD', async () => {
        await doTest(
          USDT,
          BUSD,
          holders[USDT],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('CheeseSwap', () => {
    describe('Simpleswap', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '100000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('WBNB -> BUSD', async () => {
        await doTest(
          WBNB,
          BUSD,
          holders[WBNB],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('Multi', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('WBNB -> BUSD', async () => {
        await doTest(
          WBNB,
          BUSD,
          holders[WBNB],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('Mega', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('BNB -> BUSD', async () => {
        await doTest(
          BNB,
          BUSD,
          holders[BNB],
          '7000000000000000000',
          SwapSide.BUY,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('BUSD -> BNB', async () => {
        await doTest(
          BUSD,
          BNB,
          holders[BUSD],
          '7000000000000',
          SwapSide.BUY,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
      it('WBNB -> BUSD', async () => {
        await doTest(
          WBNB,
          BUSD,
          holders[WBNB],
          '7000000000000000000',
          SwapSide.BUY,
          EXCHANGES.CHEESESWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });
});
