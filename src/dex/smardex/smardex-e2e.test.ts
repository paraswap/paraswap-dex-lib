import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Smardex E2E Mainnet', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  describe('Smardex', () => {
    const dexKey = 'Smardex';

    describe('Simpleswap', () => {
      describe('SELL small amounts', () => {
        it('ETH -> SDEX', async () => {
          await testE2E(
            tokens.ETH,
            tokens.SDEX,
            holders.ETH,
            '2000000000000000000', // 2 ETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('SDEX -> ETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.ETH,
            holders.SDEX,
            '300000000000000000000000', // 300K SDEX
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('WETH -> SDEX', async () => {
          await testE2E(
            tokens.WETH,
            tokens.SDEX,
            holders.WETH,
            '1500000000000000000', // 1.5 WETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('SDEX -> WETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.WETH,
            holders.SDEX,
            '250000000000000000000000', // 250K SDEX
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('USDT -> SDEX', async () => {
          await testE2E(
            tokens.USDT,
            tokens.SDEX,
            holders.USDT,
            '1200000000', // 1200 USDT
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('SDEX -> USDT', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.USDT,
            holders.SDEX,
            '300000000000000000000000', // 300K SDEX
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('WBTC -> WETH', async () => {
          await testE2E(
            tokens.WBTC,
            tokens.WETH,
            holders.WBTC,
            '30000000', // 0.3 WBTC
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('WETH -> WBTC', async () => {
          await testE2E(
            tokens.WETH,
            tokens.WBTC,
            holders.WETH,
            '2500000000000000000', // 2.5 ETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('USDT -> ETH', async () => {
          await testE2E(
            tokens.USDT,
            tokens.ETH,
            holders.USDT,
            '5000000000', // 5000 USDT
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('ETH -> USDT', async () => {
          await testE2E(
            tokens.ETH,
            tokens.USDT,
            holders.ETH,
            '2500000000000000000', // 2.5K ETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('SELL big amounts', () => {
        it('ETH -> SDEX', async () => {
          await testE2E(
            tokens.ETH,
            tokens.SDEX,
            holders.ETH,
            '18000000000000000000', // 18 ETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('SDEX -> ETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.ETH,
            holders.SDEX,
            '30000000000000000000000000', // 30M SDEX
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('WETH -> SDEX', async () => {
          await testE2E(
            tokens.WETH,
            tokens.SDEX,
            holders.WETH,
            '42000000000000000000', // 42 WETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('SDEX -> WETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.WETH,
            holders.SDEX,
            '32000000000000000000000000', // 32M SDEX
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('USDT -> SDEX', async () => {
          await testE2E(
            tokens.USDT,
            tokens.SDEX,
            holders.USDT,
            '200000000000', // 200K USDT
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('SDEX -> USDT', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.USDT,
            holders.SDEX,
            '30000000000000000000000000', // 30M SDEX
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('WBTC -> WETH', async () => {
          await testE2E(
            tokens.WBTC,
            tokens.WETH,
            holders.WBTC,
            '500000000', // 5 WBTC
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });

        it('WETH -> WBTC', async () => {
          await testE2E(
            tokens.WETH,
            tokens.WBTC,
            holders.WETH,
            '42000000000000000000', // 42 ETH
            SwapSide.SELL, // exact input
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('BUY small amounts', () => {
        it('SDEX <- ETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.ETH,
            holders.SDEX,
            '2000000000000000000', // 2 WETH
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('ETH <- SDEX', async () => {
          await testE2E(
            tokens.ETH,
            tokens.SDEX,
            holders.ETH,
            '300000000000000000000000', // 300K SDEX
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('SDEX <- WETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.WETH,
            holders.SDEX,
            '1500000000000000000', // 1.5 WETH
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('WETH <- SDEX', async () => {
          await testE2E(
            tokens.WETH,
            tokens.SDEX,
            holders.WETH,
            '250000000000000000000000', // 250K SDEX
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('SDEX <- USDT', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.USDT,
            holders.SDEX,
            '1200000000', // 1200 USDT
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('USDT <- SDEX', async () => {
          await testE2E(
            tokens.USDT,
            tokens.SDEX,
            holders.USDT,
            '300000000000000000000000', // 300k SDEX
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('WETH <- WBTC', async () => {
          await testE2E(
            tokens.WETH,
            tokens.WBTC,
            holders.WETH,
            '30000000', // 0.3 WBTC
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('WBTC <- WETH', async () => {
          await testE2E(
            tokens.WBTC,
            tokens.WETH,
            holders.WBTC,
            '2500000000000000000', // 2.5 ETH
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });
      });

      describe('BUY big amounts', () => {
        it('SDEX <- ETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.ETH,
            holders.SDEX,
            '18000000000000000000', // 18 WETH
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('ETH <- SDEX', async () => {
          await testE2E(
            tokens.ETH,
            tokens.SDEX,
            holders.ETH,
            '30000000000000000000000000', // 30M SDEX
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('SDEX <- WETH', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.WETH,
            holders.SDEX,
            '42000000000000000000', // 42 WETH
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('WETH <- SDEX', async () => {
          await testE2E(
            tokens.WETH,
            tokens.SDEX,
            holders.WETH,
            '20000000000000000000000000', // 20M SDEX
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('USDT <- SDEX', async () => {
          await testE2E(
            tokens.USDT,
            tokens.SDEX,
            holders.USDT,
            '20000000000000000000000000', // 20M SDEX
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });

        it('SDEX <- USDT', async () => {
          await testE2E(
            tokens.SDEX,
            tokens.USDT,
            holders.SDEX,
            '200000000000', // 200K USDT
            SwapSide.BUY, // exact output
            dexKey,
            ContractMethod.simpleBuy,
            network,
            provider,
          );
        });
      });
    });

    // describe('Multiswap', () => {
    //   it('ETH -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.WBTC,
    //       holders.ETH,
    //       '2000000000000000000', // 2 ETH
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.multiSwap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.BADGER,
    //       tokens.ETH,
    //       holders.BADGER,
    //       '700000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.multiSwap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.multiSwap,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('swapOnUniswap', () => {
    //   it('ETH -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.WBTC,
    //       holders.ETH,
    //       '7000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[BADGER] -> ETH', async () => {
    //     await testE2E(
    //       tokens.BADGER,
    //       tokens.ETH,
    //       holders.BADGER,
    //       '700000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[USDC] -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('swapOnUniswapFork', () => {
    //   it('ETH -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.WBTC,
    //       holders.ETH,
    //       '7000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.BADGER,
    //       tokens.ETH,
    //       holders.BADGER,
    //       '700000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('swapOnUniswapV2Fork', () => {
    //   it('ETH -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.WBTC,
    //       holders.ETH,
    //       '7000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.BADGER,
    //       tokens.ETH,
    //       holders.BADGER,
    //       '700000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.swapOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('buyOnUniswap', () => {
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '700000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('ETH -> TOKEN[BADGER]', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.BADGER,
    //       holders.ETH,
    //       '700000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[USDC] -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '2000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });

    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswap,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('buyOnUniswapFork', () => {
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '700000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('ETH -> TOKEN[BADGER]', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.BADGER,
    //       holders.ETH,
    //       '700000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[USDC] -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '2000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });

    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapFork,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('buyOnUniswapV2Fork', () => {
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '700000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('ETH -> TOKEN[BADGER]', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.BADGER,
    //       holders.ETH,
    //       '700000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[USDC] -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '2000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });

    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '200000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buyOnUniswapV2Fork,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('simpleBuy', () => {
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '700000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.simpleBuy,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('ETH -> TOKEN[BADGER]', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.BADGER,
    //       holders.ETH,
    //       '700000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.simpleBuy,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[USDC] -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '2000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.simpleBuy,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '20000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.simpleBuy,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('BuyMethod', () => {
    //   it('TOKEN -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '700000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buy,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('ETH -> TOKEN[BADGER]', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.BADGER,
    //       holders.ETH,
    //       '700000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buy,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN[USDC] -> ETH', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.ETH,
    //       holders.USDT,
    //       '2000000000000000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buy,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('TOKEN -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.USDT,
    //       tokens.WBTC,
    //       holders.USDT,
    //       '20000000',
    //       SwapSide.BUY,
    //       dexKey,
    //       ContractMethod.buy,
    //       network,
    //       provider,
    //     );
    //   });
    // });

    // describe('STETH->ETH', () => {
    //   it('simpleSwap', async () => {
    //     await testE2E(
    //       tokens.STETH,
    //       tokens.ETH,
    //       holders.STETH,
    //       '1000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.simpleSwap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('multiSwap', async () => {
    //     await testE2E(
    //       tokens.STETH,
    //       tokens.ETH,
    //       holders.STETH,
    //       '1000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.multiSwap,
    //       network,
    //       provider,
    //     );
    //   });
    //   it('megaSwap', async () => {
    //     await testE2E(
    //       tokens.STETH,
    //       tokens.ETH,
    //       holders.STETH,
    //       '1000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       ContractMethod.megaSwap,
    //       network,
    //       provider,
    //     );
    //   });
    // });
  });
});
