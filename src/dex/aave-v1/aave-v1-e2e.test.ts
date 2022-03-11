import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Tokens as AaveV1Tokens } from './tokens';

/*
  README
  ======

  This test script should add e2e tests for AaveV1. The tests
  should cover as many cases as possible. Most of the DEXes follow
  the following test structure:
    - DexName
      - ForkName + Network
        - ContractMethod
          - ETH -> Token swap
          - Token -> ETH swap
          - Token -> Token swap

  The template already enumerates the basic structure which involves
  testing simpleSwap, multiSwap, megaSwap contract methods for
  ETH <> TOKEN and TOKEN <> TOKEN swaps. You should replace USDT and
  aUSDT with any two highly liquid tokens on AaveV1 for the tests
  to work. If the tokens that you would like to use are not defined in
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template
  it is highly recommended to add test cases which could be specific
  to testing AaveV1 (Eg. Tests based on poolType, special tokens,
  etc).

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-e2e.tests.ts`

  (This comment should be removed from the final implementation)
*/
jest.setTimeout(1000 * 60 * 3);

describe('AaveV1 E2E', () => {
  describe('AaveV1 MAINNET', () => {
    const dexKey = 'AaveV1';
    const network = Network.MAINNET;
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);
    // TODO: Modify the USDTSymbol, aUSDTSymbol, aETHAmount;

    const aETHSymbol: string = 'aETH';
    const aUSDTSymbol: string = 'aUSDT';
    const USDTSymbol: string = 'USDT';

    const aUSDTAmount: string = '2000000000';
    const aETHAmount: string = '100000000000000000';
    const ethAmount = '100000000000000000';

    const ETH = Tokens[network]['ETH'];
    const aETH = AaveV1Tokens[network][aETHSymbol];
    const aUSDT = AaveV1Tokens[network][aUSDTSymbol];
    const USDT = Tokens[network][USDTSymbol];

    const contractMethods: { [side in SwapSide]: ContractMethod[] } = {
      [SwapSide.SELL]: [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
      [SwapSide.BUY]: [ContractMethod.simpleBuy],
    };

    [SwapSide.SELL, SwapSide.BUY].forEach((side: SwapSide) =>
      contractMethods[side].forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('ETH -> TOKEN', async () => {
            await testE2E(
              ETH,
              aETH,
              holders['ETH'],
              side === SwapSide.SELL ? ethAmount : aETHAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('TOKEN -> ETH', async () => {
            await testE2E(
              aETH,
              ETH,
              holders[aETHSymbol],
              side === SwapSide.SELL ? aETHAmount : ethAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              USDT,
              aUSDT,
              holders[USDTSymbol],
              side === SwapSide.SELL ? aUSDTAmount : aUSDTAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
        });
      }),
    );
  });
});
