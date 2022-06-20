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
import { StaticJsonRpcProvider } from '@ethersproject/providers';

describe('UniswapV2 E2E Polygon', () => {
  const network = Network.POLYGON;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(ProviderURL[network], network);

  describe('QuickSwap', () => {
    const dexKey = 'QuickSwap';

    describe('Simpleswap', () => {
      it('QuickSwap MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('QuickSwap TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('QuickSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WMATIC,
          tokens.WETH,
          holders.WMATIC,
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
      it('QuickSwap MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('QuickSwap TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('QuickSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WMATIC,
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

    describe('BuyMethod', () => {
      it('QuickSwap MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('QuickSwap TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '7000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
      it('QuickSwap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WMATIC,
          holders.DAI,
          '70000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.buy,
          network,
          provider,
        );
      });
    });
  });

  describe('SafeSwap', () => {
    const dexKey = 'SafeSwap';

    describe('Simpleswap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.WETH,
          tokens.MATIC,
          holders.WETH,
          '10000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('Multi', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.WETH,
          tokens.MATIC,
          holders.WETH,
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
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('Mega', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.WETH,
          tokens.MATIC,
          holders.WETH,
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
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
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

  describe('Sushiswap', () => {
    const dexKey = 'SushiSwap';

    describe('Simpleswap', () => {
      it('Sushiswap MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Sushiswap TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Sushiswap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WMATIC,
          tokens.WETH,
          holders.WMATIC,
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
      it('Sushiswap MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Sushiswap TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Sushiswap TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.WMATIC,
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

  describe('Dfyn', () => {
    const dexKey = 'Dfyn';

    describe('Simpleswap', () => {
      it('Dfyn MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Dfyn TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Dfyn TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDT,
          holders.DAI,
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
      it('Dfyn MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Dfyn TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Dfyn TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDT,
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

  describe('ComethSwap', () => {
    const dexKey = 'ComethSwap';

    describe('Cometh Simpleswap', () => {
      it('Cometh MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.MUST,
          holders.MATIC,
          '70000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Cometh TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.MUST,
          tokens.MATIC,
          holders.MUST,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('Cometh TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WMATIC,
          tokens.MUST,
          holders.WMATIC,
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
      it('Cometh MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.MUST,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Cometh TOKEN -> MATIC', async () => {
        await testE2E(
          tokens.MUST,
          tokens.MATIC,
          holders.MUST,
          '5000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('Cometh TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens.WMATIC,
          tokens.MUST,
          holders.WMATIC,
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

  describe('WaultFinance', () => {
    const dexKey = 'WaultFinance';

    describe('Simpleswap', () => {
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('USDT -> USDC', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
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
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDT -> USDC', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
          '10000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap', () => {
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('USDT -> USDC', async () => {
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
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
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
      it('USDT -> USDC', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('ApeSwap', () => {
    const dexKey = 'ApeSwap';

    describe('Simpleswap', () => {
      it('MATIC -> WETH', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('DAI -> MATIC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.MATIC,
          holders.DAI,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
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
    describe('SimpleBuy', () => {
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDC -> DAI', async () => {
        await testE2E(
          tokens.USDC,
          tokens.DAI,
          holders.USDC,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
          '10000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap', () => {
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
          '700000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
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
      it('DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
          '7000000000000000000000',
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
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '10000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('USDT -> USDC', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
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
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '100000000000000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('USDT -> USDC', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
          '10000000',
          SwapSide.BUY,
          dexKey,
          ContractMethod.simpleBuy,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap', () => {
      it('USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('USDT -> USDC', async () => {
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
      it('MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
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
      it('USDT -> USDC', async () => {
        await testE2E(
          tokens.USDT,
          tokens.USDC,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('Polycat', () => {
    const dexKey = 'Polycat';

    describe('simpleSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('Token -> MATIC', async () => {
        await testE2E(
          tokens.WETH,
          tokens.MATIC,
          holders.WETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('Token -> Token', async () => {
        await testE2E(
          tokens.USDT,
          tokens.DAI,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('Token -> MATIC', async () => {
        await testE2E(
          tokens.WETH,
          tokens.MATIC,
          holders.WETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('Token -> Token', async () => {
        await testE2E(
          tokens.USDT,
          tokens.DAI,
          holders.USDT,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.WETH,
          holders.MATIC,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('Token -> MATIC', async () => {
        await testE2E(
          tokens.WETH,
          tokens.MATIC,
          holders.WETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('Token -> Token', async () => {
        await testE2E(
          tokens.USDT,
          tokens.DAI,
          holders.USDT,
          '1000000000',
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

    describe('simpleSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.RADIO,
          holders.MATIC,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('Token -> MATIC', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.MATIC,
          holders.RADIO,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('Token -> Token', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.DAI,
          holders.RADIO,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.RADIO,
          holders.MATIC,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('Token -> MATIC', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.MATIC,
          holders.RADIO,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('Token -> Token', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.DAI,
          holders.RADIO,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      it('MATIC -> TOKEN', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.RADIO,
          holders.MATIC,
          '100000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('Token -> MATIC', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.MATIC,
          holders.RADIO,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('Token -> Token', async () => {
        await testE2E(
          tokens.RADIO,
          tokens.DAI,
          holders.RADIO,
          '1000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });

  describe('Dystopia', () => {
    const dexKey = 'Dystopia';
    const usdAmount = '1000000';

    describe('Dystopia UniswapV2 Pools', () => {
      const maticAmount = '1000000000000000000';

      describe('simpleSwap', () => {
        it('MATIC -> TOKEN', async () => {
          await testE2E(
            tokens.MATIC,
            tokens.WETH,
            holders.MATIC,
            maticAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('Token -> MATIC', async () => {
          await testE2E(
            tokens.USDT,
            tokens.MATIC,
            holders.USDT,
            usdAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('Token -> Token', async () => {
          await testE2E(
            tokens.WMATIC,
            tokens.WETH,
            holders.WMATIC,
            maticAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('multiSwap', () => {
        it('MATIC -> TOKEN', async () => {
          await testE2E(
            tokens.MATIC,
            tokens.WETH,
            holders.MATIC,
            maticAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });

        it('Token -> MATIC', async () => {
          await testE2E(
            tokens.USDT,
            tokens.MATIC,
            holders.USDT,
            usdAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });

        it('Token -> Token', async () => {
          await testE2E(
            tokens.WMATIC,
            tokens.WETH,
            holders.WMATIC,
            maticAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
      });

      describe('megaSwap', () => {
        it('MATIC -> TOKEN', async () => {
          await testE2E(
            tokens.USDT,
            tokens.MATIC,
            holders.USDT,
            usdAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.megaSwap,
            network,
            provider,
          );
        });

        it('Token -> MATIC', async () => {
          await testE2E(
            tokens.USDT,
            tokens.MATIC,
            holders.USDT,
            usdAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.megaSwap,
            network,
            provider,
          );
        });

        it('Token -> Token', async () => {
          await testE2E(
            tokens.WMATIC,
            tokens.WETH,
            holders.WMATIC,
            maticAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.megaSwap,
            network,
            provider,
          );
        });
      });
    });

    describe('Dystopia Stable Pools', () => {
      describe('simpleSwap', () => {
        it('Token -> Token', async () => {
          await testE2E(
            tokens.USDC,
            tokens.USDT,
            holders.USDC,
            usdAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('multiSwap', () => {
        it('Token -> Token', async () => {
          await testE2E(
            tokens.USDC,
            tokens.USDT,
            holders.USDC,
            usdAmount,
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
      });

      describe('megaSwap', () => {
        it('Token -> Token', async () => {
          await testE2E(
            tokens.USDC,
            tokens.USDT,
            holders.USDC,
            usdAmount,
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
});
