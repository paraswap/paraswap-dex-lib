import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('ETHx', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const dexKey = 'Stader';

  ['ETH', 'WETH'].forEach(token => {
    [ContractMethod.swapExactAmountIn].forEach(contractMethod => {
      it(`${contractMethod} - ${token} ->  ETHx`, async () => {
        await testE2E(
          tokens[`${token}`],
          tokens['ETHx'],
          holders[`${token}`],
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
