/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

/*
  README
  ======

  This test script should add e2e tests for Infusion. The tests
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
  tokenB with any two highly liquid tokens on Infusion for the tests
  to work. If the tokens that you would like to use are not defined in
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template
  it is highly recommended to add test cases which could be specific
  to testing Infusion (Eg. Tests based on poolType, special tokens,
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

describe('Infusion E2E', () => {
  describe('Base', () => {
    const network = Network.BASE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Infusion', () => {
      const dexKey = 'Infusion';

      describe('simpleSwap', () => {
        it('NATIVE -> TOKEN', async () => {
          await testE2E(
            tokens.ETH,
            tokens.USDC,
            holders.ETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> NATIVE', async () => {
          await testE2E(
            tokens.USDC,
            tokens.ETH,
            holders.USDC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WETH,
            tokens.USDC,
            holders.WETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,

            network,
            provider,
          );
        });
        it('STABLE -> STABLE', async () => {
          await testE2E(
            tokens.USDbC,
            tokens.USDC,
            holders.USDbC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });
      describe('multiSwap', () => {
        it('NATIVE -> TOKEN', async () => {
          await testE2E(
            tokens.ETH,
            tokens.USDC,
            holders.ETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,

            network,
            provider,
          );
        });
        it('TOKEN -> NATIVE', async () => {
          await testE2E(
            tokens.USDC,
            tokens.ETH,
            holders.USDC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
        it('TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WETH,
            tokens.USDC,
            holders.WETH,
            '3000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
        it('STABLE -> STABLE', async () => {
          await testE2E(
            tokens.USDbC,
            tokens.USDC,
            holders.USDbC,
            '9900000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
      });
    });
  });
});
