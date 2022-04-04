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
import { JsonRpcProvider } from '@ethersproject/providers';
import { getTokenFromASymbol } from './tokens';

/*
  README
  ======

  This test script should add e2e tests for AaveV3. The tests
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
  tokenB with any two highly liquid tokens on AaveV3 for the tests
  to work. If the tokens that you would like to use are not defined in 
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template 
  it is highly recommended to add test cases which could be specific 
  to testing AaveV3 (Eg. Tests based on poolType, special tokens, 
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

jest.setTimeout(1000 * 60 * 3);

describe('AaveV3 E2E', () => {
  const dexKey = 'AaveV3';

  describe('AaveV3 POLYGON', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);

    // TODO: Modify the tokenASymbol, tokenBSymbol, tokenAAmount;
    const tokenSymbol: string = 'USDT';
    const aTokenSymbol: string = 'aUSDT';

    const amount: string = '1000000';
    const nativeTokenAmount = '1000000000000000000';

    const aToken = getTokenFromASymbol(network, 'aUSDT');

    if (!aToken) {
      expect(aToken).not.toBeNull();
      return;
    }

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          // ContractMethod.multiSwap,
          // ContractMethod.megaSwap,
        ],
      ],
      // [SwapSide.BUY, [
      //   ContractMethod.simpleBuy,
      //   ContractMethod.buy
      // ]],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('ATOKEN -> TOKEN', async () => {
            await testE2E(
              aToken,
              tokens[tokenSymbol],
              holders[aTokenSymbol],
              amount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });

          // it('TOKEN -> ATOKEN', async () => {
          //   await testE2E(
          //     tokens[tokenSymbol],
          //     aToken,
          //     holders[aTokenSymbol],
          //     amount,
          //     side,
          //     dexKey,
          //     contractMethod,
          //     network,
          //     provider,
          //   );
          // });
        });
      }),
    );

    // TODO: Add any aditional test cases required to test AaveV3
  });
});
