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

describe('MaverickV1 E2E', () => {
  const dexKey = 'MaverickV1';

  describe('MaverickV1 MAINNET', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    it('BUY USDT -> USDC', async () => {
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

    it('BUY WETH -> USDC', async () => {
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

    it('SELL USDC -> USDT', async () => {
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

    it('SELL WETH -> USDC', async () => {
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
  });
});
