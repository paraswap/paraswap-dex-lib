import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

// Balancer doesn't support USDT
describe('BalancerV1 E2E Mainnet', () => {
  const dexKey = 'BalancerV1';
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('Simpleswap SELL', () => {
    it('ETH -> USDC', async () => {
      await testE2E(
        tokens.ETH,
        tokens.USDC,
        holders.ETH,
        '300000000000000000',
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
        '2000000',
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
        '100000',
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
        '500000000000000000',
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
        '20000000',
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
