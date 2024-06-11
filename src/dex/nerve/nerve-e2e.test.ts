import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Nerve', () => {
  const dexKey = 'Nerve';

  describe('BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL BUSD -> USDC', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.USDC,
          holders.BUSD,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL BTCB -> anyBTC', async () => {
        await testE2E(
          tokens.bBTC,
          tokens.anyBTC,
          holders.bBTC,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      const contractMethod = ContractMethod.multiSwap;
      it('SELL BUSD -> USDC', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.USDC,
          holders.BUSD,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL BTCB -> anyBTC', async () => {
        await testE2E(
          tokens.bBTC,
          tokens.anyBTC,
          holders.bBTC,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;
      it('SELL BUSD -> USDC', async () => {
        await testE2E(
          tokens.BUSD,
          tokens.USDC,
          holders.BUSD,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL BTCB -> anyBTC', async () => {
        await testE2E(
          tokens.bBTC,
          tokens.anyBTC,
          holders.bBTC,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('V6', () => {
      describe(ContractMethod.swapExactAmountIn, () => {
        const contractMethod = ContractMethod.swapExactAmountIn;
        it('SELL BUSD -> USDC', async () => {
          await testE2E(
            tokens.BUSD,
            tokens.USDC,
            holders.BUSD,
            '11000000000000000000',
            SwapSide.SELL,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('SELL BTCB -> anyBTC', async () => {
          await testE2E(
            tokens.bBTC,
            tokens.anyBTC,
            holders.bBTC,
            '11000000000000000000',
            SwapSide.SELL,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
      });
    });
  });
});

describe('Axial', () => {
  const dexKey = 'Axial';

  describe('Avalanche', () => {
    const network = Network.AVALANCHE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    const contractMethod = ContractMethod.swapExactAmountIn;
    describe('simpleSwap', () => {
      // const contractMethod = ContractMethod.simpleSwap;
      it('SELL newFRAX -> MIM', async () => {
        await testE2E(
          tokens.newFRAX,
          tokens.MIM,
          holders.newFRAX,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      // const contractMethod = ContractMethod.multiSwap;
      it('SELL MIM -> USDCe', async () => {
        await testE2E(
          tokens.MIM,
          tokens.USDCe,
          holders.MIM,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL MIM -> newFRAX', async () => {
        await testE2E(
          tokens.MIM,
          tokens.newFRAX,
          holders.MIM,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;
      it('SELL MIM -> USDCe', async () => {
        await testE2E(
          tokens.MIM,
          tokens.USDCe,
          holders.MIM,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL MIM -> newFRAX', async () => {
        await testE2E(
          tokens.MIM,
          tokens.newFRAX,
          holders.MIM,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });
});

describe('IronV2', () => {
  const dexKey = 'IronV2';

  describe('Polygon_V6', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('swapExactAmountIn', () => {
      it('SELL DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
          '1100000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapExactAmountIn,
          network,
          provider,
        );
      });
      it('SELL MATIC -> USDC', async () => {
        await testE2E(
          tokens.MATIC,
          tokens.USDC,
          holders.MATIC,
          '1100000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapExactAmountIn,
          network,
          provider,
        );
      });
      it('SELL USDC -> MATIC', async () => {
        await testE2E(
          tokens.USDC,
          tokens.MATIC,
          holders.USDC,
          '1100000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.swapExactAmountIn,
          network,
          provider,
        );
      });
    });
    // describe('multiSwap', () => {
    //   const contractMethod = ContractMethod.multiSwap;
    //   it('SELL DAI -> USDC', async () => {
    //     await testE2E(
    //       tokens.DAI,
    //       tokens.USDC,
    //       holders.DAI,
    //       '11000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       contractMethod,
    //       network,
    //       provider,
    //     );
    //   });
    // });
    // describe('megaSwap', () => {
    //   const contractMethod = ContractMethod.megaSwap;
    //   it('SELL DAI -> USDC', async () => {
    //     await testE2E(
    //       tokens.DAI,
    //       tokens.USDC,
    //       holders.DAI,
    //       '11000000000000000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       contractMethod,
    //       network,
    //       provider,
    //     );
    //   });
    // });
  });
});

describe('Synapse', () => {
  const dexKey = 'Synapse';

  describe('MAINNET', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> DAI', async () => {
        await testE2E(
          tokens.USDC,
          tokens.DAI,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      const contractMethod = ContractMethod.multiSwap;

      it('SELL USDC -> DAI', async () => {
        await testE2E(
          tokens.USDC,
          tokens.DAI,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;
      it('SELL USDC -> DAI', async () => {
        await testE2E(
          tokens.USDC,
          tokens.DAI,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> BUSD', async () => {
        await testE2E(
          tokens.USDC,
          tokens.BUSD,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      const contractMethod = ContractMethod.multiSwap;

      it('SELL USDC -> BUSD', async () => {
        await testE2E(
          tokens.USDC,
          tokens.BUSD,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;
      it('SELL USDC -> BUSD', async () => {
        await testE2E(
          tokens.USDC,
          tokens.BUSD,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.swapExactAmountIn;
      it('SELL USDC -> USDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
          holders.USDC,
          '1110000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    // describe('multiSwap', () => {
    //   const contractMethod = ContractMethod.multiSwap;

    //   it('SELL USDC -> USDT', async () => {
    //     await testE2E(
    //       tokens.USDC,
    //       tokens.USDT,
    //       holders.USDC,
    //       '111000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       contractMethod,
    //       network,
    //       provider,
    //     );
    //   });
    // });
    // describe('megaSwap', () => {
    //   const contractMethod = ContractMethod.megaSwap;
    //   it('SELL USDC -> USDT', async () => {
    //     await testE2E(
    //       tokens.USDC,
    //       tokens.USDT,
    //       holders.USDC,
    //       '111000000',
    //       SwapSide.SELL,
    //       dexKey,
    //       contractMethod,
    //       network,
    //       provider,
    //     );
    //   });
    // });
  });

  describe('Avalanche', () => {
    const network = Network.AVALANCHE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDCe -> USDTe', async () => {
        await testE2E(
          tokens.USDCe,
          tokens.USDTe,
          holders.USDCe,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nETH -> avWETH', async () => {
        await testE2E(
          tokens.nETH,
          tokens.avWETH,
          holders.nETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      const contractMethod = ContractMethod.multiSwap;

      it('SELL USDCe -> USDTe', async () => {
        await testE2E(
          tokens.USDCe,
          tokens.USDTe,
          holders.USDCe,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nETH -> avWETH', async () => {
        await testE2E(
          tokens.nETH,
          tokens.avWETH,
          holders.nETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;
      it('SELL USDCe -> USDTe', async () => {
        await testE2E(
          tokens.USDCe,
          tokens.USDTe,
          holders.USDCe,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nETH -> avWETH', async () => {
        await testE2E(
          tokens.nETH,
          tokens.avWETH,
          holders.nETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> nUSD', async () => {
        await testE2E(
          tokens.USDC,
          tokens.nUSD,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nUSD -> MIM', async () => {
        await testE2E(
          tokens.nUSD,
          tokens.MIM,
          holders.nUSD,
          '111000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nETH -> WETH', async () => {
        await testE2E(
          tokens.nETH,
          tokens.WETH,
          holders.nETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('multiSwap', () => {
      const contractMethod = ContractMethod.multiSwap;
      it('SELL USDC -> nUSD', async () => {
        await testE2E(
          tokens.USDC,
          tokens.nUSD,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nUSD -> MIM', async () => {
        await testE2E(
          tokens.nUSD,
          tokens.MIM,
          holders.nUSD,
          '111000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nETH -> WETH', async () => {
        await testE2E(
          tokens.nETH,
          tokens.WETH,
          holders.nETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('megaSwap', () => {
      const contractMethod = ContractMethod.megaSwap;
      it('SELL USDC -> nUSD', async () => {
        await testE2E(
          tokens.USDC,
          tokens.nUSD,
          holders.USDC,
          '111000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nUSD -> MIM', async () => {
        await testE2E(
          tokens.nUSD,
          tokens.MIM,
          holders.nUSD,
          '111000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL nETH -> WETH', async () => {
        await testE2E(
          tokens.nETH,
          tokens.WETH,
          holders.nETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });
});
