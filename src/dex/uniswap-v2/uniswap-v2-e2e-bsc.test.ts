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
  const network = Network.BSC;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new JsonRpcProvider(ProviderURL[network], network);

  describe('PancakeSwapV2', () => {
    const dexKey = 'PancakeSwapV2';

    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.BUSD,
          holders.DAI,
          '7000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.BUSD,
          holders.DAI,
          '7000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('BuyMethod', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.BUSD,
          holders.DAI,
          '7000000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });
  });

  describe('JulSwap', () => {
    const dexKey = 'JulSwap';

    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.WBNB,
          holders.BUSD,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.WBNB,
          holders.BUSD,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('ApeSwap', () => {
    const dexKey = 'ApeSwap';

    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.BUSD,
          holders.DAI,
          '7000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.BUSD,
          holders.DAI,
          '7000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('PancakeSwap', () => {
    const dexKey = 'PancakeSwap';

    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WBNB,
          holders.DAI,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WBNB,
          holders.DAI,
          '7000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('BakerySwap', () => {
    const dexKey = 'BakerySwap';

    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('Street Swap', () => {
    const dexKey = 'StreetSwap';

    describe('Simpleswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WBNB,
          holders.DAI,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WBNB,
          holders.DAI,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('PantherSwap', () => {
    const dexKey = 'PantherSwap';

    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('TOKEN -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.USDT,
          holders.BUSD,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WBNB,
          holders.DAI,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('TOKEN -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('MDEX', () => {
    const dexKey = 'MDEX';

    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.USDT,
          holders.BNB,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BNB,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('BUY', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.USDT,
          holders.BNB,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.USDT,
          holders.BNB,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BNB,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('Megapath', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('BiSwap', () => {
    const dexKey = 'BiSwap';

    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.USDT,
          holders.BNB,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BNB,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('BUY', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.USDT,
          holders.BNB,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.USDT,
          holders.BNB,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BNB,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('Megapath', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('RadioShack', () => {
    const dexKey = 'RadioShack';

    describe('Simpleswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.RADIO,
          holders.BNB,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.RADIO,
          holders.BUSD,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.BNB,
          holders.RADIO,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('BUY', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.RADIO,
          holders.BNB,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.RADIO,
          holders.BUSD,
          '1000000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.BNB,
          holders.RADIO,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('BNB -> TOKEN', async () => {
        await testE2E(
          tokens.BNB,
          tokens.RADIO,
          holders.BNB,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.RADIO,
          holders.BUSD,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Token -> BNB', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.BNB,
          holders.RADIO,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('Megapath', () => {
      it('Token -> TOKEN', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.RADIO,
          holders.BUSD,
          '1000000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('WaultFinance', () => {
    const dexKey = 'WaultFinance';

    describe('Simpleswap', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '10000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '10000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('MegaSwap', () => {
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('CoinSwap', () => {
    const dexKey = 'CoinSwap';

    describe('Simpleswap', () => {
      it('BUSD -> WBNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.WBNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('BUSD -> WBNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.WBNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });

      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });

      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '1000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });

    describe('MultiSwap', () => {
      it('BUSD -> WBNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.WBNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('MegaSwap', () => {
      it('BUSD -> WBNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.WBNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
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

  describe('JetSwap', () => {
    const dexKey = 'JetSwap';

    describe('Simpleswap', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '10000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '10000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '10000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('MegaSwap', () => {
      it('USDT -> BUSD', async () => {
        await testE2E(
          tokens.USDT,
          tokens.BUSD,
          holders.USDT,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('CheeseSwap', () => {
    const dexKey = 'CheeseSwap';

    describe('Simpleswap', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '100000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('WBNB -> BUSD', async () => {
        await testE2E(
          tokens.WBNB,
          tokens.BUSD,
          holders.WBNB,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('Multi', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('WBNB -> BUSD', async () => {
        await testE2E(
          tokens.WBNB,
          tokens.BUSD,
          holders.WBNB,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('Mega', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '30000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
    describe('SimpleBuy', () => {
      it('BNB -> BUSD', async () => {
        await testE2E(
          tokens.BNB,
          tokens.BUSD,
          holders.BNB,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('BUSD -> BNB', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.BNB,
          holders.BUSD,
          '7000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('WBNB -> BUSD', async () => {
        await testE2E(
          tokens.WBNB,
          tokens.BUSD,
          holders.WBNB,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
  });
});
