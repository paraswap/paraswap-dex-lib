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

/*
  README
  ======

  This test script should add e2e tests for Weth. The tests
  should cover as many cases as possible. Most of the DEXes follow
  the following test structure:
    - DexName
      - ForkName + Network
        - ContractMethod
          - ETH -> Token swap
          - Token -> ETH swap
          - Token -> Token swap

  The template already enumerates the basic structure which involves
  testing simpleSwap, multiSwap, megaSwap contract methods for
  ETH <> TOKEN and TOKEN <> TOKEN swaps. You should replace tokenA and
  tokenB with any two highly liquid tokens on Weth for the tests
  to work. If the tokens that you would like to use are not defined in
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template
  it is highly recommended to add test cases which could be specific
  to testing Weth (Eg. Tests based on poolType, special tokens,
  etc).

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-e2e.tests.ts`

  (This comment should be removed from the final implementation)
*/

describe('Weth E2E', () => {
  describe('Weth Mainnet', () => {
    const dexKey = 'Weth';
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);
    // TODO: Modify the tokenASymbol, tokenBSymbol, tokenAAmount;
    const tokenASymbol: string = 'tokenASymbol';
    const tokenBSymbol: string = 'tokenBSymbol';
    const tokenAAmount: string = 'tokenAAmount';
    const tokenBAmount: string = 'tokenBAmount';
    const ethAmount = '1000000000000000000';
    // TODO: Add any direct swap contractMethod name if it exists
    // TODO: If buy is not supported remove the buy contract methods
    const contractMethods: { [side: sell]: ContractMethod } = {
      [SwapSide.SELL]: [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
      [SwapSide.BUY]: [ContractMethod.simpleBuy, ContractMethod.buy],
    };

    [SwapSide.SELL, SwapSide.BUY].forEach((side: SwapSide) =>
      sellContractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('ETH -> TOKEN', async () => {
            await testE2E(
              tokens['ETH'],
              tokens[tokenASymbol],
              holders['ETH'],
              side === SwapSide.SELL ? ethAmount : tokenAAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('TOKEN -> ETH', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens['ETH'],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenAAmount : ethAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[tokenBSymbol],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
        });
      }),
    );

    // TODO: Add any aditional test cases required to test Weth
  });

  describe('Wbnb BSC', () => {
    describe('Simpleswap', () => {
      it('BNB -> WBNB', async () => {
        await doTest(
          BNB,
          WBNB,
          holders[BNB],
          '1000000000000000000',
          SwapSide.SELL,
          'wbnb',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });

      it('WBNB -> BNB', async () => {
        await doTest(
          WBNB,
          BNB,
          holders[WBNB],
          '1000000000000000000',
          SwapSide.SELL,
          'wbnb',
          [ContractMethod.simpleSwap],
          undefined,
          undefined,
          BSC_NETWORK_ID,
        );
      });
    });
  });

  describe('Wmatic Polygon', () => {
    it('MATIC -> WMATIC simpleSwap', async () => {
      await doTest(
        MATIC,
        WMATIC,
        holders[MATIC],
        '10000000000000000000',
        SwapSide.SELL,
        'wmatic',
        [ContractMethod.simpleSwap],
        undefined,
        undefined,
        POLYGON_NETWORK_ID,
      );
    });

    it('WMATIC -> MATIC simpleSwap', async () => {
      await doTest(
        WMATIC,
        MATIC,
        holders[WMATIC],
        '100000000000000000000',
        SwapSide.SELL,
        'wmatic',
        [ContractMethod.simpleSwap],
        undefined,
        undefined,
        POLYGON_NETWORK_ID,
      );
    });

    it('MATIC -> WMATIC multiSwap', async () => {
      await doTest(
        MATIC,
        WMATIC,
        holders[MATIC],
        '10000000000000000000',
        SwapSide.SELL,
        'wmatic',
        [ContractMethod.multiSwap],
        undefined,
        undefined,
        POLYGON_NETWORK_ID,
      );
    });

    it('WMATIC -> MATIC multiSwap', async () => {
      await doTest(
        WMATIC,
        MATIC,
        holders[WMATIC],
        '100000000000000000000',
        SwapSide.SELL,
        'wmatic',
        [ContractMethod.multiSwap],
        undefined,
        undefined,
        POLYGON_NETWORK_ID,
      );
    });
  });

  describe('Wavax Avalanche', () => {
    it('AVAX -> WAVAX simpleSwap', async () => {
      await doTest(
        AVAX,
        WAVAX,
        holders[AVAX],
        '10000000000000000000',
        SwapSide.SELL,
        'wavax',
        [ContractMethod.simpleSwap],
        undefined,
        undefined,
        AVALANCHE_NETWORK_ID,
      );
    });

    it('WAVAX -> AVAX simpleSwap', async () => {
      await doTest(
        WAVAX,
        AVAX,
        holders[WAVAX],
        '100000000000000000000',
        SwapSide.SELL,
        'wavax',
        [ContractMethod.simpleSwap],
        undefined,
        undefined,
        AVALANCHE_NETWORK_ID,
      );
    });

    it('AVAX -> WAVAX multiSwap', async () => {
      await doTest(
        AVAX,
        WAVAX,
        holders[AVAX],
        '100000000000000000000',
        SwapSide.SELL,
        'wavax',
        [ContractMethod.multiSwap],
        undefined,
        undefined,
        AVALANCHE_NETWORK_ID,
      );
    });

    it('WAVAX -> AVAX multiSwap', async () => {
      await doTest(
        WAVAX,
        AVAX,
        holders[WAVAX],
        '100000000000000000000',
        SwapSide.SELL,
        'wavax',
        [ContractMethod.multiSwap],
        undefined,
        undefined,
        AVALANCHE_NETWORK_ID,
      );
    });
  });

  describe('Wftm Fantom', () => {
    it('FTM -> WFTM simpleSwap', async () => {
      await doTest(
        FTM,
        WFTM,
        holders[FTM],
        '100000000000000000000',
        SwapSide.SELL,
        EXCHANGES.WFTM,
        [ContractMethod.simpleSwap],
        undefined,
        undefined,
        <any>FANTOM_NETWORK_ID,
      );
    });

    it('WFTM -> FTM simpleSwap', async () => {
      await doTest(
        WFTM,
        FTM,
        holders[WFTM],
        '100000000000000000000',
        SwapSide.SELL,
        EXCHANGES.WFTM,
        [ContractMethod.simpleSwap],
        undefined,
        undefined,
        <any>FANTOM_NETWORK_ID,
      );
    });

    it('FTM -> WFTM multiSwap', async () => {
      await doTest(
        FTM,
        WFTM,
        holders[FTM],
        '100000000000000000000',
        SwapSide.SELL,
        EXCHANGES.WFTM,
        [ContractMethod.multiSwap],
        undefined,
        undefined,
        <any>FANTOM_NETWORK_ID,
      );
    });

    it('WFTM -> FTM multiSwap', async () => {
      await doTest(
        WFTM,
        FTM,
        holders[WFTM],
        '100000000000000000000',
        SwapSide.SELL,
        EXCHANGES.WFTM,
        [ContractMethod.multiSwap],
        undefined,
        undefined,
        <any>FANTOM_NETWORK_ID,
      );
    });
  });
});
