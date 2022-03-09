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
  const network = Network.AVALANCHE;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new JsonRpcProvider(ProviderURL[network]);

  describe('PangolinSwap', () => {
    const dexKey = 'PangolinSwap';

    describe('simpleSwap', () => {
      it('AVAX -> USDT.e', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDT.e -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('BuyMethod', () => {
      it('AVAX -> USDT.e', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });

      it('USDT.e -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });
  });

  describe('TraderJoe', () => {
    const dexKey = 'TraderJoe';

    describe('simpleSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
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

    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('CanarySwap', () => {
    const dexKey = 'CanarySwap';

    describe('simpleSwap', () => {
      it('AVAX -> PNG', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.PNG,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('PNG -> AVAX', async () => {
        await testE2E(
          tokens.PNG,
          tokens.AVAX,
          holders.PNG,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> PNG', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.PNG,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> PNG', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.PNG,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('PNG -> AVAX', async () => {
        await testE2E(
          tokens.PNG,
          tokens.AVAX,
          holders.PNG,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> PNG', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.PNG,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> PNG', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.PNG,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('PNG -> AVAX', async () => {
        await testE2E(
          tokens.PNG,
          tokens.AVAX,
          holders.PNG,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> PNG', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.PNG,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('BaguetteSwap', () => {
    const dexKey = 'BaguetteSwap';

    describe('simpleSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '10000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.AVAX,
          holders.USDTe,
          '10000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDTe', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDTe,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDTe -> AVAX', async () => {
        await testE2E(
          tokens.USDTe,
          tokensAVAX,
          holders.USDTe,
          '10000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('ComplusSwap', () => {
    const dexKey = 'ComplusSwap';

    describe('simpleSwap', () => {
      it('AVAX -> USDT', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDT,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '100000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> USDT', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDT,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '100000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> USDT', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.USDT,
          holders.AVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '100000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('ElkFinance', () => {
    const dexKey = 'ElkFinance';

    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDT', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDT,
          holders.WAVAX,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('Thorus', () => {
    const dexKey = 'Thorus';

    describe('simpleSwap', () => {
      it('AVAX -> THO', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.THO,
          holders.AVAX,
          '10000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('THO -> AVAX', async () => {
        await testE2E(
          tokens.THO,
          tokens.AVAX,
          holders.THO,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('THO -> USDCe', async () => {
        await testE2E(
          tokens.THO,
          tokens.USDCe,
          holders.THO,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> THO', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.THO,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('THO -> AVAX', async () => {
        await testE2E(
          tokens.THO,
          tokens.AVAX,
          holders.THO,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('THO -> USDCe', async () => {
        await testE2E(
          tokens.THO,
          tokens.USDCe,
          holders.THO,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> THO', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.THO,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('THO -> AVAX', async () => {
        await testE2E(
          tokens.THO,
          tokens.AVAX,
          holders.THO,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('THO -> USDCe', async () => {
        await testE2E(
          tokens.THO,
          tokens.USDCe,
          holders.THO,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('Olive', () => {
    const dexKey = 'Olive';

    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDT.e -> DAI.e', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.DAIE,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDT.e -> DAI.e', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.DAIE,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '300000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDT.e -> DAI.e', async () => {
        await testE2E(
          tokens.USDTe,
          tokens.DAIE,
          holders.USDTe,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('YetiSwap', () => {
    const dexKey = 'YetiSwap';

    describe('simpleSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('AVAX -> ETH', async () => {
        await testE2E(
          tokens.AVAX,
          tokens.ETH,
          holders.AVAX,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('ETH -> AVAX', async () => {
        await testE2E(
          tokens.ETH,
          tokens.AVAX,
          holders.ETH,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WAVAX -> USDTe', async () => {
        await testE2E(
          tokens.WAVAX,
          tokens.USDTe,
          holders.WAVAX,
          '3000000000000000000',
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
