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

describe('UniswapV2 E2E Fantom', () => {
  describe('SpookySwap', () => {
    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('BuyMethod', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.buy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.buy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.SPOOKYSWAP,
          [ContractMethod.buy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });
  });

  describe('SpiritSwap', () => {
    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.SPIRITSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });
  });

  describe('SushiSwap', () => {
    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });
  });

  describe('PaintSwap', () => {
    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.PAINTSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });
  });

  describe('KnightSwap', () => {
    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.KNIGHTSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });
  });

  describe('MorpheusSwap', () => {
    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });

      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await doTest(
          FTM,
          USDC,
          holders[FTM],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('USDC -> FTM', async () => {
        await doTest(
          USDC,
          FTM,
          holders[USDC],
          '70000000000000000000',
          SwapSide.BUY,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
      it('WFTM -> USDC', async () => {
        await doTest(
          WFTM,
          USDC,
          holders[WFTM],
          '700000000',
          SwapSide.BUY,
          EXCHANGES.MORPHEUSSWAP,
          [ContractMethod.simpleBuy],
          undefined,
          undefined,
          <any>FANTOM_NETWORK_ID,
        );
      });
    });
  });
});
