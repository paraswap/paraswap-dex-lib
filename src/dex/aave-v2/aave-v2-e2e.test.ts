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
import { aaveV2GetToken } from './tokens';

jest.setTimeout(1000 * 60 * 3);

describe('AaveV2 E2E', () => {
  describe('AaveV2 MAINNET', () => {
    const dexKey = 'AaveV2';
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network]);

    const ETH = tokens['ETH'];
    const aWETH = aaveV2GetToken(network, 'aWETH');
    const WETH = tokens['WETH'];
    const USDT = tokens['USDT'];
    const aUSDT = aaveV2GetToken(network, 'aUSDT');

    expect(aWETH).not.toBe(null);
    expect(aUSDT).not.toBe(null);

    const ethAmount = '1000000000000000000';
    const aUSDTAmount: string = '2000000000';

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
          it('ETH -> WETH', async () => {
            await testE2E(
              ETH,
              aWETH!,
              holders['ETH'],
              ethAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('aWETH -> ETH', async () => {
            await testE2E(
              aWETH!,
              ETH,
              holders['aWETH'],
              ethAmount,
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
              holders['USDT'],
              aUSDTAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('aWETH -> wETH', async () => {
            await testE2E(
              aWETH!,
              WETH,
              holders['aWETH'],
              ethAmount,
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
