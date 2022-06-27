import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { aaveV1GetToken } from './tokens';
import { generateConfig } from '../../config';

jest.setTimeout(1000 * 60 * 3);

describe('AaveV1 E2E', () => {
  describe('AaveV1 MAINNET', () => {
    const dexKey = 'AaveV1';
    const network = Network.MAINNET;
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );
    // TODO: Modify the USDTSymbol, aUSDTSymbol, aETHAmount;

    const aETHSymbol: string = 'aETH';
    const aUSDTSymbol: string = 'aUSDT';
    const USDTSymbol: string = 'USDT';

    const aUSDTAmount: string = '2000000000';
    const USDTAmount: string = '2000000000';
    const aETHAmount: string = '100000000000000000';
    const ethAmount = '100000000000000000';

    const ETH = Tokens[network]['ETH'];
    const aETH = aaveV1GetToken(network, aETHSymbol);
    const aUSDT = aaveV1GetToken(network, aUSDTSymbol);

    expect(aETH).not.toBe(null);
    expect(aUSDT).not.toBe(null);
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
          it('ETH -> aETH', async () => {
            await testE2E(
              ETH,
              aETH!,
              holders['ETH'],
              side === SwapSide.SELL ? ethAmount : aETHAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('aETH -> ETH', async () => {
            await testE2E(
              aETH!,
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
          it('USDT -> aUSDT', async () => {
            await testE2E(
              USDT,
              aUSDT!,
              holders[USDTSymbol],
              side === SwapSide.SELL ? USDTAmount : aUSDTAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('aUSDT -> USDT', async () => {
            await testE2E(
              aUSDT!,
              USDT,
              holders[aUSDTSymbol],
              side === SwapSide.SELL ? aUSDTAmount : USDTAmount,
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
