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
import { aaveV1GetToken } from './tokens';

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
    const aETH = aaveV1GetToken(network, aETHSymbol);
    const aUSDT = aaveV1GetToken(network, aUSDTSymbol);

    if (!aETH) {
      console.log(aETH);
      expect(aETH).not.toBe(null);
      return;
    }
    if (!aUSDT) {
      expect(aUSDT).not.toBe(null);
      return;
    }
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
