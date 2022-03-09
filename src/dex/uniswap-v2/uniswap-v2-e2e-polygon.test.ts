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

describe('UniswapV2 E2E Polygon', () => {
  it('simpleBuy USDC -> BTU', async () => {
    await doTest(
      USDC,
      BTU,
      holders[USDC],
      '10000000000000000000',
      SwapSide.BUY,
      undefined,
      undefined,
      undefined,
      undefined,
      POLYGON_NETWORK_ID,
    );
  });

  describe('QuickSwap', () => {
    describe('Simpleswap', () => {
      it('QuickSwap MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'QuickSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('QuickSwap TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[DAI],
          '700000000000000000000',
          SwapSide.SELL,
          'QuickSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('QuickSwap TOKEN -> TOKEN', async () => {
        await doTest(
          WMATIC,
          WETH,
          holders[WMATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'QuickSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('QuickSwap MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'QuickSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('QuickSwap TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[DAI],
          '7000000000000000000',
          SwapSide.SELL,
          'QuickSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('QuickSwap TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          WMATIC,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'QuickSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });

    describe('BuyMethod', () => {
      it('QuickSwap MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.BUY,
          'QuickSwap',
          [ContractMethod.buy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('QuickSwap TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[DAI],
          '7000000000000000000',
          SwapSide.BUY,
          'QuickSwap',
          [ContractMethod.buy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('QuickSwap TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          WMATIC,
          holders[DAI],
          '70000000000000000000',
          SwapSide.BUY,
          'QuickSwap',
          [ContractMethod.buy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('SafeSwap', () => {
    describe('Simpleswap', () => {
      it('MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '70000000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('TOKEN -> MATIC', async () => {
        await doTest(
          WETH,
          MATIC,
          holders[WETH],
          '10000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          USDC,
          holders[DAI],
          '100000000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('Multy', () => {
      it('MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('TOKEN -> MATIC', async () => {
        await doTest(
          WETH,
          MATIC,
          holders[WETH],
          '10000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          USDC,
          holders[DAI],
          '100000000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('Mega', () => {
      it('MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('TOKEN -> MATIC', async () => {
        await doTest(
          WETH,
          MATIC,
          holders[WETH],
          '10000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          USDC,
          holders[DAI],
          '100000000000000000000',
          SwapSide.SELL,
          'SafeSwap',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('Sushiswap', () => {
    describe('Simpleswap', () => {
      it('Sushiswap MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Sushiswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Sushiswap TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[WETH],
          '700000000000000000000',
          SwapSide.SELL,
          'Sushiswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Sushiswap TOKEN -> TOKEN', async () => {
        await doTest(
          WMATIC,
          WETH,
          holders[WMATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Sushiswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Sushiswap MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'SushiSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Sushiswap TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[DAI],
          '700000000000000000000',
          SwapSide.SELL,
          'Sushiswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Sushiswap TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          WMATIC,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'Sushiswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('Dfyn', () => {
    describe('Simpleswap', () => {
      it('Dfyn MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Dfyn',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Dfyn TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[WETH],
          '70000000000000000000',
          SwapSide.SELL,
          'Dfyn',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Dfyn TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          USDT,
          holders[DAI],
          '7000000000000000000',
          SwapSide.SELL,
          'Dfyn',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Dfyn MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Dfyn',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Dfyn TOKEN -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'Dfyn',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Dfyn TOKEN -> TOKEN', async () => {
        await doTest(
          DAI,
          USDT,
          holders[DAI],
          '70000000000000000000',
          SwapSide.SELL,
          'Dfyn',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('Cometh', () => {
    describe('Cometh Simpleswap', () => {
      it('Cometh MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          MUST,
          holders[MATIC],
          '70000000000000000000',
          SwapSide.SELL,
          'Cometh',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Cometh TOKEN -> MATIC', async () => {
        await doTest(
          MUST,
          MATIC,
          holders[MUST],
          '7000000000000000000',
          SwapSide.SELL,
          'Cometh',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Cometh TOKEN -> TOKEN', async () => {
        await doTest(
          WMATIC,
          MUST,
          holders[WMATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Cometh',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });

    describe('Multiswap', () => {
      it('Cometh MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          MUST,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Cometh',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Cometh TOKEN -> MATIC', async () => {
        await doTest(
          MUST,
          MATIC,
          holders[MUST],
          '7000000000000000000',
          SwapSide.SELL,
          'Cometh',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('Cometh TOKEN -> TOKEN', async () => {
        await doTest(
          WMATIC,
          MUST,
          holders[WMATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'Cometh',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('WaultFinance', () => {
    describe('Simpleswap', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '10000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '100000000000000000000',
          SwapSide.BUY,
          'WaultFinance',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.BUY,
          'WaultFinance',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '10000000',
          SwapSide.BUY,
          'WaultFinance',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('MultiSwap', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '1000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('MegaSwap', () => {
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          'WaultFinance',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('ApeSwap V2', () => {
    describe('Simpleswap', () => {
      it('MATIC -> WETH', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '7000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('DAI -> MATIC', async () => {
        await doTest(
          DAI,
          MATIC,
          holders[DAI],
          '700000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('DAI -> USDC', async () => {
        await doTest(
          DAI,
          USDC,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '100000000000000000000',
          SwapSide.BUY,
          'apeswap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDC -> DAI', async () => {
        await doTest(
          USDC,
          DAI,
          holders[USDC],
          '100000000000000000000',
          SwapSide.BUY,
          'apeswap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '10000000',
          SwapSide.BUY,
          'apeswap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('MultiSwap', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '1000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('DAI -> USDC', async () => {
        await doTest(
          DAI,
          USDC,
          holders[DAI],
          '700000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('MegaSwap', () => {
      it('DAI -> USDC', async () => {
        await doTest(
          DAI,
          USDC,
          holders[DAI],
          '7000000000000000000000',
          SwapSide.SELL,
          'apeswap',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('JetSwap', () => {
    describe('Simpleswap', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '10000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '100000000000000000000',
          SwapSide.BUY,
          'JetSwap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.BUY,
          'JetSwap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '10000000',
          SwapSide.BUY,
          'JetSwap',
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('MultiSwap', () => {
      it('USDC -> MATIC', async () => {
        await doTest(
          USDC,
          MATIC,
          holders[USDC],
          '1000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
      it('MATIC -> USDC', async () => {
        await doTest(
          MATIC,
          USDC,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('MegaSwap', () => {
      it('USDT -> USDC', async () => {
        await doTest(
          USDT,
          USDC,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          'JetSwap',
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });

  describe('Polycat', () => {
    describe('simpleSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });

      it('Token -> MATIC', async () => {
        await doTest(
          WETH,
          MATIC,
          holders[WETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });

      it('Token -> Token', async () => {
        await doTest(
          USDT,
          DAI,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('multiSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });

      it('Token -> MATIC', async () => {
        await doTest(
          WETH,
          MATIC,
          holders[WETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });

      it('Token -> Token', async () => {
        await doTest(
          USDT,
          DAI,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
    describe('megaSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await doTest(
          MATIC,
          WETH,
          holders[MATIC],
          '100000000000000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });

      it('Token -> MATIC', async () => {
        await doTest(
          WETH,
          MATIC,
          holders[WETH],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });

      it('Token -> Token', async () => {
        await doTest(
          USDT,
          DAI,
          holders[USDT],
          '1000000000',
          SwapSide.SELL,
          EXCHANGES.POLYCAT,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          POLYGON_NETWORK_ID,
        );
      });
    });
  });
});
