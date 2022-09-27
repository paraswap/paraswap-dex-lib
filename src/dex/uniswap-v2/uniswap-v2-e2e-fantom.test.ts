import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('UniswapV2 E2E Fantom', () => {
  const network = Network.FANTOM;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('SpookySwap', () => {
    const dexKey = 'SpookySwap';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('BuyMethod', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });
  });

  describe('SpiritSwap', () => {
    const dexKey = 'SpiritSwap';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
  });

  describe('SushiSwap', () => {
    const dexKey = 'SushiSwap';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
  });

  describe('PaintSwap', () => {
    const dexKey = 'PaintSwap';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
  });

  describe('KnightSwap', () => {
    const dexKey = 'KnightSwap';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
  });

  describe('MorpheusSwap', () => {
    const dexKey = 'MorpheusSwap';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
  });

  describe('Excalibur', () => {
    const dexKey = 'Excalibur';

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
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
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });

    describe('simpleBuy', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('BuyMethod', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '100000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '700000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });
  });

  describe('Tombswap', () => {
    const dexKey = 'Tombswap';

    describe('simpleSwap', () => {
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> WFTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WFTM,
          holders.USDC,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('TOMB -> WFTM', async () => {
        await testE2E(
          tokens.TOMB,
          tokens.WFTM,
          holders.TOMB,
          '15000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> WFTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WFTM,
          holders.USDC,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('TOMB -> WFTM', async () => {
        await testE2E(
          tokens.TOMB,
          tokens.WFTM,
          holders.TOMB,
          '15000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> WFTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.WFTM,
          holders.USDC,
          '3000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('TOMB -> WFTM', async () => {
        await testE2E(
          tokens.TOMB,
          tokens.WFTM,
          holders.TOMB,
          '15000000000000000000',
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
