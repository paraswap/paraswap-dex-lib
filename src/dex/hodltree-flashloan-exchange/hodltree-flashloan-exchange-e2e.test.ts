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

  This test script should add e2e tests for HodltreeFlashloanExchange. The tests
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
  tokenB with any two highly liquid tokens on HodltreeFlashloanExchange for the tests
  to work. If the tokens that you would like to use are not defined in 
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template 
  it is highly recommended to add test cases which could be specific 
  to testing HodltreeFlashloanExchange (Eg. Tests based on poolType, special tokens, 
  etc). 

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-e2e.test.ts`

  e2e tests use the Tenderly fork api. Please add the following to your 
  .env file:
  TENDERLY_TOKEN=Find this under Account>Settings>Authorization.
  TENDERLY_ACCOUNT_ID=Your Tenderly account name.
  TENDERLY_PROJECT=Name of a Tenderly project you have created in your 
  dashboard.

  (This comment should be removed from the final implementation)
*/

describe('HodltreeFlashloanExchange E2E', () => {
  const dexKey = 'HodltreeFlashloanExchange';

  describe('HodltreeFlashloanExchange MAINNET', () => {
    const network = Network.ROPSTEN;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);

    const tokenAAmount: string = (100 * 1e18).toString();
    const tokenBAmount: string = (100 * 1e6).toString();
    const tokenCAmount: string = (100 * 1e6).toString();

    const sideToContractMethods = new Map([
      [SwapSide.SELL, [ContractMethod.simpleSwap]],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('FRAX' + ' -> USDT', async () => {
            await testE2E(
              tokens['FRAX'],
              tokens['USDT'],
              holders['FRAX'],
              side == SwapSide.SELL ? tokenAAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('USDT -> ' + 'USDC', async () => {
            await testE2E(
              tokens['USDT'],
              tokens['USDC'],
              holders['USDT'],
              side == SwapSide.SELL ? tokenBAmount : tokenCAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              tokens['USDT'],
              tokens['FRAX'],
              holders['USDT'],
              side === SwapSide.SELL ? tokenCAmount : tokenAAmount,
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
