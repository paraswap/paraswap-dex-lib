import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

describe('WooFi E2E', () => {
  const dexKey = 'WooFi';

  describe('WooFi BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(ProviderURL[network], network);

    const tokenASymbol: string = 'WBNB';
    const tokenBSymbol: string = 'USDT';
    const nativeTokenSymbol = NativeTokenSymbols[network];

    const tokenAAmount: string = '3000000000000000000';
    const tokenBAmount: string = '111000000000000000000';
    const nativeTokenAmount = '3000000000000000000';

    // SELL
    // ContractMethod.multiSwap,
    // ContractMethod.megaSwap,

    // BUY
    // ContractMethod.buy

    describe('SELL', () => {
      const side = SwapSide.SELL;
      describe('simpleSwap', () => {
        const contractMethod = ContractMethod.simpleSwap;

        it('BNB -> QUOTE TOKEN', async () => {
          await testE2E(
            tokens[nativeTokenSymbol],
            tokens[tokenBSymbol],
            holders[nativeTokenSymbol],
            nativeTokenAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('QUOTE TOKEN -> BNB', async () => {
          await testE2E(
            tokens[tokenBSymbol],
            tokens[nativeTokenSymbol],
            holders[tokenBSymbol],
            tokenBAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('BASE TOKEN -> QUOTE TOKEN', async () => {
          await testE2E(
            tokens[tokenASymbol],
            tokens[tokenBSymbol],
            holders[tokenASymbol],
            tokenAAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('QUOTE TOKEN -> BASE TOKEN', async () => {
          await testE2E(
            tokens[tokenBSymbol],
            tokens[tokenASymbol],
            holders[tokenBSymbol],
            tokenBAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
      });
    });

    describe('BUY', () => {
      const side = SwapSide.BUY;
      describe('simpleBuy', () => {
        const contractMethod = ContractMethod.simpleBuy;
        it('BNB -> QUOTE TOKEN', async () => {
          await testE2E(
            tokens[nativeTokenSymbol],
            tokens[tokenBSymbol],
            holders[nativeTokenSymbol],
            tokenBAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('QUOTE TOKEN -> BNB', async () => {
          await testE2E(
            tokens[tokenBSymbol],
            tokens[nativeTokenSymbol],
            holders[tokenBSymbol],
            nativeTokenAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('BASE TOKEN -> QUOTE TOKEN', async () => {
          await testE2E(
            tokens[tokenASymbol],
            tokens[tokenBSymbol],
            holders[tokenASymbol],
            tokenBAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('QUOTE TOKEN -> BASE TOKEN', async () => {
          await testE2E(
            tokens[tokenBSymbol],
            tokens[tokenASymbol],
            holders[tokenBSymbol],
            tokenAAmount,
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
});
