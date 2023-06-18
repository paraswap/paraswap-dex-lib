import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { getRpcProvider } from '../../web3-provider';
import * as net from 'net';

describe('UniswapV2 E2E Fantom', () => {
  const network = Network.FANTOM;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = getRpcProvider(network);

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

  describe(`Swapsicle`, () => {
    const dexKey = 'Swapsicle';

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
    ]);

    const pairs: { name: string; sellAmount: string; buyAmount: string }[][] = [
      [
        { name: 'WFTM', sellAmount: '7000000000000000000', buyAmount: '1000' },
        { name: 'USDC', sellAmount: '5000', buyAmount: '10000000' },
      ],
      [
        { name: 'WFTM', sellAmount: '3000000000', buyAmount: '1000' },
        { name: 'POPS', sellAmount: '800000000000', buyAmount: '800000000000' },
      ],
      [
        { name: 'WFTM', sellAmount: '7000000000000000000', buyAmount: '1000' },
        { name: 'MIM', sellAmount: '1000', buyAmount: '1000' },
      ],
      [
        { name: 'WFTM', sellAmount: '7000000000000000000', buyAmount: '1000' },
        { name: 'DAI', sellAmount: '1000', buyAmount: '1000' },
      ],
      [
        { name: 'WFTM', sellAmount: '7000000000000000000', buyAmount: '1000' },
        { name: 'FUSDT', sellAmount: '1000', buyAmount: '1000' },
      ],
    ];

    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          pairs.forEach(pair => {
            describe(`${contractMethod}`, () => {
              it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                await testE2E(
                  tokens[pair[0].name],
                  tokens[pair[1].name],
                  holders[pair[0].name],
                  side === SwapSide.SELL
                    ? pair[0].sellAmount
                    : pair[0].buyAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
              it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                await testE2E(
                  tokens[pair[1].name],
                  tokens[pair[0].name],
                  holders[pair[1].name],
                  side === SwapSide.SELL
                    ? pair[1].sellAmount
                    : pair[1].buyAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
            });
          });
        });
      }),
    );
  });
});
