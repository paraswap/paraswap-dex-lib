/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Holders, Tokens } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { InceptionConfig, InceptionNativeConfig } from './config';
import { DexParams } from './types';

function testForNetwork(
  network: Network,
  inceptionSlug: string,
  config: DexParams,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  const baseSlug = config.baseTokenSlug;
  const tokens = Tokens[network];
  const holders = Holders[network];

  const sideToContractMethods = new Map([
    [SwapSide.SELL, ['deposit' as ContractMethod]],
  ]);

  describe(`${inceptionSlug} on ${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${baseSlug} -> ${inceptionSlug}`, async () => {
              await testE2E(
                tokens[baseSlug],
                tokens[inceptionSlug],
                holders[baseSlug],
                '1000000000',
                side,
                inceptionSlug,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });
}

describe('Inception E2E', () => {
  describe('Mainnet', () => {
    const network = Network.MAINNET;

    Object.entries(InceptionConfig).forEach(
      ([inceptionSymbol, chainConfig]) => {
        testForNetwork(network, inceptionSymbol, chainConfig[network]);
      },
    );

    Object.entries(InceptionNativeConfig).forEach(
      ([inceptionSymbol, chainConfig]) => {
        testForNetwork(network, dexKey, inceptionSymbol, chainConfig[network]);
      },
    );
  });
});
