import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Holders, Tokens } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { getRpcProvider } from '../../web3-provider';

describe('MaverickV1 E2E', () => {
  const dexKey = 'MaverickV1';

  describe('MaverickV1 MAINNET', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = getRpcProvider(network);

    it('simpleBuy USDT -> USDC', async () => {
      await testE2E(
        tokens['USDT'],
        tokens['USDC'],
        holders['USDT'],
        '1000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });

    it('simpleBuy WETH -> USDC', async () => {
      await testE2E(
        tokens['WETH'],
        tokens['USDC'],
        holders['WETH'],
        '1700000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });

    it('simpleSwap USDC -> USDT', async () => {
      await testE2E(
        tokens['USDC'],
        tokens['USDT'],
        holders['USDC'],
        '1000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });

    it('simpleSwap WETH -> USDC', async () => {
      await testE2E(
        tokens['WETH'],
        tokens['USDC'],
        holders['WETH'],
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });

    it('multiSwap WETH -> USDC', async () => {
      await testE2E(
        tokens['WETH'],
        tokens['USDC'],
        holders['WETH'],
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });

    it('multiSwap USDT -> ETH', async () => {
      await testE2E(
        tokens['USDT'],
        tokens['USDC'],
        holders['USDT'],
        '100000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.multiSwap,
        network,
        provider,
      );
    });

    it('Buy WETH -> USDC', async () => {
      await testE2E(
        tokens['WETH'],
        tokens['USDC'],
        holders['WETH'],
        '100000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.buy,
        network,
        provider,
      );
    });
  });
});
