import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Holders, Tokens } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { getRpcProvider } from '../../web3-provider';

/*
  README
  ======

  This test script should add e2e tests for JarvisV6. The tests
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
  tokenB with any two highly liquid tokens on JarvisV6 for the tests
  to work. If the tokens that you would like to use are not defined in
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template
  it is highly recommended to add test cases which could be specific
  to testing JarvisV6 (Eg. Tests based on poolType, special tokens,
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

describe('JarvisV6 E2E', () => {
  const dexKey = 'JarvisV6';

  describe('JarvisV6 MAINNET', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = getRpcProvider(network);

    const jEURSymbol: string = 'jEUR';
    const USDCSymbol: string = 'USDC';

    const jEURAmount: string = '1000000000000000000';
    const USDCAmount: string = '1000000';

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

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('jEUR -> USDC', async () => {
            await testE2E(
              tokens[jEURSymbol],
              tokens[USDCSymbol],
              holders[jEURSymbol],
              side === SwapSide.SELL ? jEURAmount : USDCAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });

          it('USDC -> jEUR', async () => {
            await testE2E(
              tokens[USDCSymbol],
              tokens[jEURSymbol],
              holders[USDCSymbol],
              side === SwapSide.SELL ? USDCAmount : jEURAmount,
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
