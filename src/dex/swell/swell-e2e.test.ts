import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Swell', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const dexKey = 'Swell';

  ['SWETH', 'rswETH'].forEach(token => {
    [
      // ContractMethod.simpleSwap,
      // ContractMethod.multiSwap,
      // ContractMethod.megaSwap,
      ContractMethod.swapExactAmountIn,
    ].forEach(contractMethod => {
      it(`${contractMethod} - ETH -> ${token}`, async () => {
        await testE2E(
          tokens.ETH,
          tokens[token],
          holders.ETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it(`${contractMethod} - WETH -> ${token}`, async () => {
        await testE2E(
          tokens.WETH,
          tokens[token],
          holders.WETH,
          '1000000000000000000',
          SwapSide.SELL,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });
});
