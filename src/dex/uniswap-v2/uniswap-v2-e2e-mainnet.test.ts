import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { UniswapV2FunctionsV6 } from './types';

describe('UniswapV2 E2E Mainnet', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  describe('UniswapV2', () => {
    const dexKey = 'UniswapV2';
    console.log('[!!!!]UniswapV2 E2E Mainnet Tests');
    describe('UniswapV2 Simpleswap', () => {
      it('WETH -> DAI', async () => {
        await testE2E(
          tokens.USDC,
          tokens.USDT,
          holders.USDC,
          '1000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });
  });
});
