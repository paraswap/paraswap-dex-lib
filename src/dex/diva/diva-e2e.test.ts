import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Diva', () => {
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const dexKey = 'Diva';

  [
    ContractMethod.simpleSwap,
    ContractMethod.multiSwap,
    ContractMethod.megaSwap,
  ].forEach(contractMethod => {
    it(`${contractMethod} - ETH -> divWETH`, async () => {
      await testE2E(
        tokens.ETH,
        tokens.SWETH,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        contractMethod,
        network,
        provider,
      );
    });

    it(`${contractMethod} - WETH -> divWETH`, async () => {
      await testE2E(
        tokens.WETH,
        tokens.SWETH,
        holders.WETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        contractMethod,
        network,
        provider,
      );
    });

    it(`${contractMethod} - ETH -> wdivWETH`, async () => {
      await testE2E(
        tokens.ETH,
        tokens.SWETH,
        holders.ETH,
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        contractMethod,
        network,
        provider,
      );
    });

    it(`${contractMethod} - WETH -> wdivWETH`, async () => {
      await testE2E(
        tokens.WETH,
        tokens.SWETH,
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
