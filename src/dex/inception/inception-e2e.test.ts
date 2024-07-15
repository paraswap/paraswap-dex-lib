/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Holders, Tokens } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { InceptionConfig } from './config';
import { DexParams } from './types';

function testForNetwork(
  network: Network,
  inceptionName: string,
  configs: DexParams[],
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  for (const config of configs) {
    const baseSlug = config.baseTokenSlug;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const inceptionSlug = config.symbol;

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
                  '100000000',
                  side,
                  inceptionName,
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
}

describe('Inception E2E', () => {
  describe('Mainnet', () => {
    const network = Network.MAINNET;

    Object.entries(InceptionConfig).forEach(([inceptionName, chainConfig]) => {
      testForNetwork(network, inceptionName, chainConfig[network]);
    });
  });
});
