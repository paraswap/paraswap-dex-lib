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
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
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
      const contractMethod = ContractMethod.multiSwap;
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

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
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
      it('SELL DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
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
      it('SELL DAI -> USDC', async () => {
        await testE2E(
          tokens.DAI,
          tokens.USDC,
          holders.DAI,
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
          '11000000',
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
          '11000000',
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
          '11000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Fantom', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> FUSDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FUSDT,
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
      it('SELL USDC -> fUSDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FUSDT,
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
      it('SELL USDC -> fUSDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FUSDT,
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
});

describe('ZyberswapStable', () => {
  const dexKey = 'ZyberswapStable';

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    const pairs: { name: string; sellAmount: string }[][] = [
      [
        { name: 'USDC', sellAmount: '111000000' },
        { name: 'USDT', sellAmount: '111000000' },
      ],
      [
        { name: 'USDC', sellAmount: '111000000' },
        { name: 'DAI', sellAmount: '111000000000000000' },
      ],
      [
        { name: 'USDT', sellAmount: '111000000' },
        { name: 'DAI', sellAmount: '111000000000000000' },
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
                  pair[0].sellAmount,
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
                  pair[1].sellAmount,
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

describe('Saddle', () => {
  const dexKey = 'Saddle';

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL FEI -> newFRAX', async () => {
        await testE2E(
          tokens.FEI,
          tokens.newFRAX,
          holders.FEI,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL wBTC -> renBTC', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.renBTC,
          holders.WBTC,
          '100000000',
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
      it('SELL FEI -> FRAX', async () => {
        await testE2E(
          tokens.FEI,
          tokens.newFRAX,
          holders.FEI,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL wBTC -> renBTC', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.renBTC,
          holders.WBTC,
          '100000000',
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
      it('SELL FEI -> FRAX', async () => {
        await testE2E(
          tokens.FEI,
          tokens.newFRAX,
          holders.FEI,
          '11000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('SELL wBTC -> renBTC', async () => {
        await testE2E(
          tokens.WBTC,
          tokens.renBTC,
          holders.WBTC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Fantom', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> FRAX', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FRAX,
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
      it('SELL USDC -> FRAX', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FRAX,
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
      it('SELL USDC -> FRAX', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FRAX,
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
      it('SELL USDC -> FRAX', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FRAX,
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
      it('SELL USDC -> FRAX', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FRAX,
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
      it('SELL USDC -> FRAX', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FRAX,
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
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> USDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
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

      it('SELL USDC -> USDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
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
      it('SELL USDC -> USDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
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

  describe('Fantom', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    describe('simpleSwap', () => {
      const contractMethod = ContractMethod.simpleSwap;
      it('SELL USDC -> FUSDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FUSDT,
          holders.USDC,
          '111000000',
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

      it('SELL USDC -> fUSDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FUSDT,
          holders.USDC,
          '111000000',
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
      it('SELL USDC -> fUSDT', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FUSDT,
          holders.USDC,
          '111000000',
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
