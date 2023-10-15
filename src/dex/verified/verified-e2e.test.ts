/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

function testForNetwork(
  network: Network,
  dexKey: string,
  cashTokenSymbol: string,
  securityTokenSymbol: string,
  cashTokenAmount: string,
  securityTokenAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];

  // TODO: Add any direct swap contractMethod name if it exists
  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        // ContractMethod.multiSwap, //won't work without adapter according to paraswap repo issue
        // ContractMethod.megaSwap, //won't work without adapter according to paraswap repo issue
      ],
    ],
    // TODO: If buy is not supported remove the buy contract methods
    // [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]], //will be tested when simpleSwap has been figured out
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            //Verified pools only supports currency to security swap
            //no native token swap for now so we only test token to token swaps
            it(`${cashTokenSymbol} -> ${securityTokenSymbol}`, async () => {
              await testE2E(
                tokens[cashTokenSymbol],
                tokens[securityTokenSymbol],
                holders[cashTokenSymbol],
                side === SwapSide.SELL ? cashTokenAmount : securityTokenAmount,
                side,
                dexKey,
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

describe('Verified E2E', () => {
  //BalancerV2 as dexKey not Verified because e2e test keeps using BalancerV2 even though Verified is passed
  //This keep throwing dex key error from getDexByKey in src/dex/index.ts line 286
  const dexKey = 'BalancerV2';

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const cashTokenSymbol: string = 'USDC';
    const securityTokenSymbol: string = 'CH1265330';

    const cashTokenAmount: string = '1000000';
    const securityTokenAmount: string = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      cashTokenSymbol,
      securityTokenSymbol,
      cashTokenAmount,
      securityTokenAmount,
    );
  });
});
