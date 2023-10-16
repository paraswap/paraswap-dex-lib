/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

jest.setTimeout(50 * 1000);
describe('Verified E2E', () => {
  const dexKey = 'Verified';

  describe('Verified POLYGON', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const securityTokenSymbol: string = 'CH1265330';
    const cashTokenSymbol: string = 'USDC';

    const securityTokenAmount: string = '1000000000000000000';
    const cashTokenAmount: string = '1000000';

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          // ContractMethod.multiSwap, //adapter needs to be approved and added by paraswap to test
          // ContractMethod.megaSwap, // adapter needs to be approved and added by paraswap to test
        ],
      ],
      // [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]], will be tested when simpleswap has been resolved
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it(`${securityTokenSymbol} -> ${cashTokenSymbol}`, async () => {
            await testE2E(
              tokens[securityTokenSymbol],
              tokens[cashTokenSymbol],
              holders[securityTokenSymbol],
              side === SwapSide.SELL ? securityTokenAmount : cashTokenAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });

          //will test when first test has been resolved
          // it(`${cashTokenSymbol} -> ${securityTokenSymbol}`, async () => {
          //   await testE2E(
          //     tokens[cashTokenSymbol],
          //     tokens[securityTokenSymbol],
          //     holders[cashTokenSymbol],
          //     side === SwapSide.SELL ? cashTokenAmount : securityTokenAmount,
          //     side,
          //     dexKey,
          //     contractMethod,
          //     network,
          //     provider,
          //   );
          // });
        });
      }),
    );
  });
});
