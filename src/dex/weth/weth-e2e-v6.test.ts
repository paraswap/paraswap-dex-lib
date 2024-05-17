import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

const NETWORKS = [
  Network.MAINNET,
  Network.ARBITRUM,
  Network.AVALANCHE,
  Network.BSC,
  Network.BASE,
  Network.POLYGON,
  Network.FANTOM,
  Network.OPTIMISM,
];

const dexKey = 'Weth';

const nativeTokenSymbol = 'ETH';
const wrappedTokenSymbol = 'WETH';

const nativeAmount = '1000000000000000000';
const wrappedAmount = '1000000000000000000';

describe('Weth E2E v6', () => {
  NETWORKS.forEach(network => {
    describe(`${network}`, () => {
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new StaticJsonRpcProvider(
        generateConfig(network).privateHttpProvider,
        network,
      );

      const nativeToken = tokens[nativeTokenSymbol];
      const wrappedToken = tokens[wrappedTokenSymbol];

      const nativeHolder = holders[nativeTokenSymbol];
      const wrappedHolder = holders[wrappedTokenSymbol];

      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
      ].forEach(contractMethod => {
        describe(`${contractMethod}`, () => {
          it('native -> wrapped', async () => {
            await testE2E(
              nativeToken,
              wrappedToken,
              nativeHolder,
              nativeAmount,
              SwapSide.SELL,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          // it('wrapped -> native', async () => {
          //   await testE2E(
          //     wrappedToken,
          //     nativeToken,
          //     wrappedHolder,
          //     wrappedAmount,
          //     SwapSide.SELL,
          //     dexKey,
          //     contractMethod,
          //     network,
          //     provider,
          //   );
          // });
        });
      });
    });
  });
});
