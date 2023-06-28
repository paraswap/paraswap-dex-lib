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

describe('RamsesV2 E2E', () => {
  const dexKey = 'RamsesV2';

  describe('UniswapV3 MAINNET', () => {
    const network = Network.ARBITRUM;
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
        holders['DAI'],
        '100000000000',
        SwapSide.BUY,
        dexKey,
        ContractMethod.simpleBuy,
        network,
        provider,
      );
    });
    it('SELL WETH -> RDNT', async () => {
      await testE2E(
        tokens['WETH'],
        tokens['RDNT'],
        holders['WETH'],
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });

    it('directSwap SELL WETH -> USDC', async () => {
      await testE2E(
        tokens['WETH'],
        tokens['USDC'],
        holders['WETH'],
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.directUniV3Swap,
        network,
        provider,
      );
    });
  });
});
