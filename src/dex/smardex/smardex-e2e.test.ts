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
      it('WETH -> TOKEN', async () => {
        await testE2E(
          tokens.WETH,
          tokens.USDT,
          holders.WETH,
          '2000000000000000000', // 2 WETH
          SwapSide.SELL, // exact input
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      // it('WETH <- TOKEN', async () => {
      //   await testE2E(
      //     tokens.WETH,
      //     tokens.USDT,
      //     holders.WETH,
      //     '2000000000000000000', // 2 WETH
      //     SwapSide.BUY, // exact output
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });

      // it('ETH -> TOKEN', async () => {
      //   await testE2E(
      //     tokens.ETH,
      //     tokens.USDT,
      //     holders.ETH,
      //     '7000000000000000000', // 7 ETH
      //     SwapSide.SELL, // exact input
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });
      // it('ETH <- TOKEN', async () => {
      //   await testE2E(
      //     tokens.ETH,
      //     tokens.USDT,
      //     holders.ETH,
      //     '7000000000000000000', // 7 ETH
      //     SwapSide.BUY, // exact output
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });
    });

    // describe('Multiswap', () => {
    //   it('ETH -> TOKEN', async () => {
    //     await testE2E(
    //       tokens.ETH,
    //       tokens.WBTC,
    //       holders.ETH,
    //       '7000000000000000',
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
