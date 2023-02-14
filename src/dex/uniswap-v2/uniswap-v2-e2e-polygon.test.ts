import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Holders, Tokens } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('UniswapV2 E2E Polygon', () => {
  const network = Network.POLYGON;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

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
          '100000',
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

    describe('FeeOnTransfer', () => {
      describe('sell', () => {
        describe('megaSwap', () => {
          it('WMATIC -> HANZO', async () => {
            await testE2E(
              tokens.WMATIC,
              tokens.HANZO,
              holders.WMATIC,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 0, srcDexFee: 0, destDexFee: 500 },
            );
          });
          it('HANZO -> WMATIC', async () => {
            await testE2E(
              tokens.HANZO,
              tokens.WMATIC,
              holders.HANZO,
              '41234567000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.megaSwap,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
            );
          });
        });
        describe('swapOnUniswapV2Fork', () => {
          it('WMATIC -> HANZO', async () => {
            await testE2E(
              tokens.WMATIC,
              tokens.HANZO,
              holders.WMATIC,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.swapOnUniswapV2Fork,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 0, srcDexFee: 0, destDexFee: 500 },
            );
          });
          it('HANZO -> WMATIC', async () => {
            await testE2E(
              tokens.HANZO,
              tokens.WMATIC,
              holders.HANZO,
              '41234567000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.swapOnUniswapV2Fork,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
            );
          });
        });
      });
      describe('buy', () => {
        describe('buy', () => {
          it('HANZO -> WMATIC', async () => {
            await testE2E(
              tokens.HANZO,
              tokens.WMATIC,
              holders.HANZO,
              '1000000000000000000',
              SwapSide.BUY,
              dexKey,
              ContractMethod.buy,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
            );
          });
        });
        describe('buyOnUniswapV2Fork', () => {
          it('HANZO -> WMATIC', async () => {
            await testE2E(
              tokens.HANZO,
              tokens.WMATIC,
              holders.HANZO,
              '1000000000000000000',
              SwapSide.BUY,
              dexKey,
              ContractMethod.buyOnUniswapV2Fork,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
            );
          });
        });
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
        { name: 'MATIC', sellAmount: '100000000000000000', buyAmount: '1000' },
        { name: 'USDC', sellAmount: '10000000', buyAmount: '1000' },
      ],
      [
        { name: 'MATIC', sellAmount: '1000000000', buyAmount: '1000' },
        { name: 'DAI', sellAmount: '50000', buyAmount: '1000000000' },
      ],
      [
        { name: 'MATIC', sellAmount: '100000000000000000', buyAmount: '1000' },
        { name: 'USDT', sellAmount: '100000000', buyAmount: '1000' },
      ],
      [
        { name: 'MATIC', sellAmount: '10000000', buyAmount: '1000' },
        { name: 'POPS', sellAmount: '8000000', buyAmount: '1000' },
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
