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

  This test script should add e2e tests for BalancerV1. The tests
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
  tokenB with any two highly liquid tokens on BalancerV1 for the tests
  to work. If the tokens that you would like to use are not defined in
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template
  it is highly recommended to add test cases which could be specific
  to testing BalancerV1 (Eg. Tests based on poolType, special tokens,
  etc).

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-e2e.tests.ts`

  (This comment should be removed from the final implementation)
*/

// Balancer doesn't support USDT
describe('BalancerV1 E2E Mainnet', () => {
  const dexKey = 'BalancerV1';
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new JsonRpcProvider(ProviderURL[network]);

  describe('Simpleswap SELL', () => {
    it('ETH -> USDC', async () => {
      await testE2E(
        tokens.ETH,
        tokens.USDC,
        holders.ETH,
        '7000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
    it('USDC -> ETH', async () => {
      await testE2E(
        tokens.USDC,
        tokens.ETH,
        holders.USDC,
        '2000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
    it('USDC -> LINK', async () => {
      await testE2E(
        tokens.USDC,
        tokens.LINK,
        holders.USDC,
        '2000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
    it('WBTC -> LINK', async () => {
      await testE2E(
        tokens.WBTC,
        tokens.LINK,
        holders.WBTC,
        '200000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
  });

  describe('Multiswap SELL', () => {
    it('ETH -> WBTC', async () => {
      await testE2E(
        tokens.ETH,
        tokens.WBTC,
        holders.ETH,
        '7000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });
    it('USDC -> ETH', async () => {
      await testE2E(
        tokens.USDC,
        tokens.ETH,
        holders.USDC,
        '2000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });
    it('USDC -> WBTC', async () => {
      await testE2E(
        tokens.USDC,
        tokens.WBTC,
        holders.USDC,
        '2000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });
  });

  describe('SimpleBuy BUY', () => {
    it('ETH -> WBTC', async () => {
      await testE2E(
        tokens.ETH,
        tokens.WBTC,
        holders.ETH,
        '35000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
    it('USDC -> ETH', async () => {
      await testE2E(
        tokens.USDC,
        tokens.ETH,
        holders.USDC,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
    it('USDC -> WETH', async () => {
      await testE2E(
        tokens.USDC,
        tokens.WETH,
        holders.USDC,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
  });

  describe('Buy BUY', () => {
    it('ETH -> WBTC', async () => {
      await testE2E(
        tokens.ETH,
        tokens.WBTC,
        holders.ETH,
        '35000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
    it('USDC -> ETH', async () => {
      await testE2E(
        tokens.USDC,
        tokens.ETH,
        holders.USDC,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
    it('USDC -> WETH', async () => {
      await testE2E(
        tokens.USDC,
        tokens.WETH,
        holders.USDC,
        '1000000000000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
  });
});
