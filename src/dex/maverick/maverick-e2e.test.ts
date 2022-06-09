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

describe('Maverick E2E', () => {
  const dexKey = 'Maverick';

  describe('Maverick POLYGON', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(ProviderURL[network], network);

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'WETH';
    const nativeTokenSymbol = NativeTokenSymbols[network];

    const tokenAAmount: string = '1000000';
    const nativeTokenAmount = '1000000000000000000';

    const sideToContractMethods = new Map([
      [SwapSide.SELL, [ContractMethod.simpleSwap]],
    ]);
    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it(nativeTokenSymbol + ' -> TOKEN', async () => {
            await testE2E(
              tokens[nativeTokenSymbol],
              tokens[tokenASymbol],
              holders[nativeTokenSymbol],
              nativeTokenAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('TOKEN -> ' + nativeTokenSymbol, async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[nativeTokenSymbol],
              holders[tokenASymbol],
              tokenAAmount,
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
              tokenAAmount,
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
  });
});
