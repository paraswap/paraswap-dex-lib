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
    });
  });
});
