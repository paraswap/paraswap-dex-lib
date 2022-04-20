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

describe('Weth E2E', () => {
  describe('Weth Mainnet', () => {
    const dexKey = 'Weth';
    const network = Network.MAINNET;

    const nativeTokenSymbol = 'ETH';
    const wrappedTokenSymbol = 'WETH';

    const nativeAmount = '1000000000000000000';
    const wrappedAmount = '1000000000000000000';

    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const nativeToken = tokens[nativeTokenSymbol];
    const wrappedToken = tokens[wrappedTokenSymbol];

    const nativeHolder = holders[nativeTokenSymbol];
    const wrappedHolder = holders[wrappedTokenSymbol];

    describe('SimpleSwap SELL', () => {
      const contractMethod = ContractMethod.simpleSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap SELL', () => {
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });

    describe('MegaSwap SELL', () => {
      const contractMethod = ContractMethod.megaSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Wbnb BSC', () => {
    const dexKey = 'Wbnb';
    const network = Network.BSC;

    const nativeTokenSymbol = 'BNB';
    const wrappedTokenSymbol = 'WBNB';

    const nativeAmount = '1000000000000000000';
    const wrappedAmount = '1000000000000000000';

    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const nativeToken = tokens[nativeTokenSymbol];
    const wrappedToken = tokens[wrappedTokenSymbol];

    const nativeHolder = holders[nativeTokenSymbol];
    const wrappedHolder = holders[wrappedTokenSymbol];

    describe('SimpleSwap SELL', () => {
      const contractMethod = ContractMethod.simpleSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap SELL', () => {
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });

    describe('MegaSwap SELL', () => {
      const contractMethod = ContractMethod.megaSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Wmatic Polygon', () => {
    const dexKey = 'Wmatic';
    const network = Network.POLYGON;

    const nativeTokenSymbol = 'MATIC';
    const wrappedTokenSymbol = 'WMATIC';

    const nativeAmount = '1000000000000000000';
    const wrappedAmount = '1000000000000000000';

    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const nativeToken = tokens[nativeTokenSymbol];
    const wrappedToken = tokens[wrappedTokenSymbol];

    const nativeHolder = holders[nativeTokenSymbol];
    const wrappedHolder = holders[wrappedTokenSymbol];

    describe('SimpleSwap SELL', () => {
      const contractMethod = ContractMethod.simpleSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap SELL', () => {
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });

    describe('MegaSwap SELL', () => {
      const contractMethod = ContractMethod.megaSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Wftm Fantom', () => {
    const dexKey = 'Wftm';
    const network = Network.FANTOM;

    const nativeTokenSymbol = 'FTM';
    const wrappedTokenSymbol = 'WFTM';

    const nativeAmount = '1000000000000000000';
    const wrappedAmount = '1000000000000000000';

    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const nativeToken = tokens[nativeTokenSymbol];
    const wrappedToken = tokens[wrappedTokenSymbol];

    const nativeHolder = holders[nativeTokenSymbol];
    const wrappedHolder = holders[wrappedTokenSymbol];

    describe('SimpleSwap SELL', () => {
      const contractMethod = ContractMethod.simpleSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap SELL', () => {
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });

    describe('MegaSwap SELL', () => {
      const contractMethod = ContractMethod.megaSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });

  describe('Wavax Avalanche', () => {
    const dexKey = 'Wavax';
    const network = Network.AVALANCHE;

    const nativeTokenSymbol = 'AVAX';
    const wrappedTokenSymbol = 'WAVAX';

    const nativeAmount = '1000000000000000000';
    const wrappedAmount = '1000000000000000000';

    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const nativeToken = tokens[nativeTokenSymbol];
    const wrappedToken = tokens[wrappedTokenSymbol];

    const nativeHolder = holders[nativeTokenSymbol];
    const wrappedHolder = holders[wrappedTokenSymbol];

    describe('SimpleSwap SELL', () => {
      const contractMethod = ContractMethod.simpleSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
    describe('MultiSwap SELL', () => {
      const contractMethod = ContractMethod.multiSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });

    describe('MegaSwap SELL', () => {
      const contractMethod = ContractMethod.megaSwap;
      const side = SwapSide.SELL;

      it('native -> wrapped', async () => {
        await testE2E(
          nativeToken,
          wrappedToken,
          nativeHolder,
          nativeAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
      it('wrapped -> native', async () => {
        await testE2E(
          wrappedToken,
          nativeToken,
          wrappedHolder,
          wrappedAmount,
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
