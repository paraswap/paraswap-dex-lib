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

describe('UniswapV2 E2E Avalanche', () => {
  describe('Pangolin', () => {
    describe('simpleSwap', () => {
      it('AVAX -> USDT.e', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDT.e -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.PANGOLIN,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('BuyMethod', () => {
      it('AVAX -> USDT.e', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.PANGOLIN,
          [ContractMethod.buy],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDT.e -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '7000000000000000000',
          SwapSide.BUY,
          EXCHANGES.PANGOLIN,
          [ContractMethod.buy],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '100000000',
          SwapSide.BUY,
          EXCHANGES.PANGOLIN,
          [ContractMethod.buy],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('TraderJoe', () => {
    describe('simpleSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '1000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '1000000000000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.TRADERJOE,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('SushiSwap', () => {
    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.SUSHISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('Canary', () => {
    describe('simpleSwap', () => {
      it('AVAX -> PNG', async () => {
        await doTest(
          AVAX,
          PNG,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('PNG -> AVAX', async () => {
        await doTest(
          PNG,
          AVAX,
          holders[PNG],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> PNG', async () => {
        await doTest(
          WAVAX,
          PNG,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> PNG', async () => {
        await doTest(
          AVAX,
          PNG,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('PNG -> AVAX', async () => {
        await doTest(
          PNG,
          AVAX,
          holders[PNG],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> PNG', async () => {
        await doTest(
          WAVAX,
          PNG,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> PNG', async () => {
        await doTest(
          AVAX,
          PNG,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('PNG -> AVAX', async () => {
        await doTest(
          PNG,
          AVAX,
          holders[PNG],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> PNG', async () => {
        await doTest(
          WAVAX,
          PNG,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.CANARY,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('Baguette', () => {
    describe('simpleSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.simpleSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '10000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.simpleSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.simpleSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.multiSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '10000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.multiSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.multiSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDTe', async () => {
        await doTest(
          AVAX,
          USDTe,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.megaSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDTe -> AVAX', async () => {
        await doTest(
          USDTe,
          AVAX,
          holders[USDTe],
          '10000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.megaSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.BAGUETTE,
          [ContractMethod.megaSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('Complus', () => {
    describe('simpleSwap', () => {
      it('AVAX -> USDT', async () => {
        await doTest(
          AVAX,
          USDT,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.simpleSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '100000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.simpleSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.simpleSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDT', async () => {
        await doTest(
          AVAX,
          USDT,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.multiSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '100000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.multiSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.multiSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDT', async () => {
        await doTest(
          AVAX,
          USDT,
          holders[AVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.megaSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '100000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.megaSwap],
          18,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '7000000000000000000',
          SwapSide.SELL,
          EXCHANGES.COMPLUS,
          [ContractMethod.megaSwap],
          18,
          6,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('Elk', () => {
    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDT', async () => {
        await doTest(
          WAVAX,
          USDT,
          holders[WAVAX],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.ELK,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('Thorus', () => {
    describe('simpleSwap', () => {
      it('AVAX -> THO', async () => {
        await doTest(
          AVAX,
          THO,
          holders[AVAX],
          '10000000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.simpleSwap],
          undefined,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('THO -> AVAX', async () => {
        await doTest(
          THO,
          AVAX,
          holders[THO],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.simpleSwap],
          18,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('THO -> USDCe', async () => {
        await doTest(
          THO,
          USDCe,
          holders[THO],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.simpleSwap],
          18,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> THO', async () => {
        await doTest(
          AVAX,
          THO,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.multiSwap],
          undefined,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('THO -> AVAX', async () => {
        await doTest(
          THO,
          AVAX,
          holders[THO],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.multiSwap],
          18,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('THO -> USDCe', async () => {
        await doTest(
          THO,
          USDCe,
          holders[THO],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.multiSwap],
          18,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> THO', async () => {
        await doTest(
          AVAX,
          THO,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.megaSwap],
          undefined,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('THO -> AVAX', async () => {
        await doTest(
          THO,
          AVAX,
          holders[THO],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.megaSwap],
          18,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('THO -> USDCe', async () => {
        await doTest(
          THO,
          USDCe,
          holders[THO],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.THORUS,
          [ContractMethod.megaSwap],
          18,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('Olive', () => {
    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDT.e -> DAI.e', async () => {
        await doTest(
          USDTe,
          DAIE,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.simpleSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDT.e -> DAI.e', async () => {
        await doTest(
          USDTe,
          DAIE,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.multiSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '300000000000000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('USDT.e -> DAI.e', async () => {
        await doTest(
          USDTe,
          DAIE,
          holders[USDTe],
          '100000000',
          SwapSide.SELL,
          EXCHANGES.OLIVE,
          [ContractMethod.megaSwap],
          6,
          18,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });

  describe('YetiSwap', () => {
    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.multiSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await doTest(
          AVAX,
          ETH,
          holders[AVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('ETH -> AVAX', async () => {
        await doTest(
          ETH,
          AVAX,
          holders[ETH],
          '30000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await doTest(
          WAVAX,
          USDTe,
          holders[WAVAX],
          '3000000000000000000',
          SwapSide.SELL,
          EXCHANGES.YETISWAP,
          [ContractMethod.megaSwap],
          undefined,
          undefined,
          AVALANCHE_NETWORK_ID,
        );
      });
    });
  });
});
