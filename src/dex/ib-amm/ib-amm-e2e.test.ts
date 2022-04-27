import dotenv from 'dotenv';
dotenv.config();
import { JsonRpcProvider } from '@ethersproject/providers';

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { SYMBOL } from './config';

jest.setTimeout(10 * 60 * 1000);

describe('IbAmm E2E', () => {
  describe('IbAmm MAINNET', () => {
    const dexKey = 'ibamm';
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);
    const TOKEN_AMOUNT: string = '1000000000000000000'; // 1e18

    const SYMBOLS = [
      SYMBOL.IBAUD,
      SYMBOL.IBCHF,
      SYMBOL.IBEUR,
      SYMBOL.IBGBP,
      SYMBOL.IBJPY,
      SYMBOL.IBKRW,
    ];

    describe(`buy`, () => {
      SYMBOLS.forEach(symbol => {
        it(`DAI -> ${symbol}`, async () => {
          await testE2E(
            tokens[SYMBOL.DAI],
            tokens[symbol],
            holders[SYMBOL.DAI],
            TOKEN_AMOUNT,
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });
    });

    describe(`sell`, () => {
      SYMBOLS.forEach(symbol => {
        it(`${symbol} -> MIM`, async () => {
          await testE2E(
            tokens[symbol],
            tokens[SYMBOL.MIM],
            holders[symbol],
            TOKEN_AMOUNT,
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });
    });
  });
});
