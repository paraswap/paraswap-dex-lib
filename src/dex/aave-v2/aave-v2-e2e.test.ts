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
    const provider = new JsonRpcProvider(ProviderURL[network], network);

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
          it('ETH -> aWETH', async () => {
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
  describe('AaveV2 POLYGON', () => {
    const dexKey = 'AaveV2';
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const MATIC = tokens['MATIC'];
    const amWMATIC = aaveV2GetToken(network, 'amWMATIC');
    const WMATIC = tokens['WMATIC'];
    const USDT = tokens['USDT'];
    const amUSDT = aaveV2GetToken(network, 'amUSDT');

    expect(amWMATIC).not.toBe(null);
    expect(amUSDT).not.toBe(null);

    const maticAmount = '1000000000000000000';
    const amUSDTAmount: string = '2000000000';

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
          it('MATIC -> amWMATIC', async () => {
            await testE2E(
              MATIC,
              amWMATIC!,
              holders['MATIC'],
              maticAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('amWMATIC -> MATIC', async () => {
            await testE2E(
              amWMATIC!,
              MATIC,
              holders['AMWMATIC'],
              maticAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('USDT -> amUSDT', async () => {
            await testE2E(
              USDT,
              amUSDT!,
              holders['USDT'],
              amUSDTAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('amWMATIC -> WMATIC', async () => {
            await testE2E(
              amWMATIC!,
              WMATIC,
              holders['AMWMATIC'],
              maticAmount,
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
  describe('AaveV2 AVALANCHE', () => {
    const dexKey = 'AaveV2';
    const network = Network.AVALANCHE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new JsonRpcProvider(ProviderURL[network], network);

    const AVAX = tokens['AVAX'];
    const avWAVAX = aaveV2GetToken(network, 'avWAVAX');
    const WAVAX = tokens['WAVAX'];
    const USDTe = tokens['USDTe'];
    const avUSDT = aaveV2GetToken(network, 'avUSDT');

    expect(avWAVAX).not.toBe(null);
    expect(avUSDT).not.toBe(null);

    const avaxAmount = '1000000000000000000';
    const avUSDTAmount: string = '2000000000';

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
          it('AVAX -> avWAVAX', async () => {
            await testE2E(
              AVAX,
              avWAVAX!,
              holders['AVAX'],
              avaxAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('avWAVAX -> AVAX', async () => {
            await testE2E(
              avWAVAX!,
              AVAX,
              holders['avWAVAX'],
              avaxAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('USDTe -> avUSDT', async () => {
            await testE2E(
              USDTe,
              avUSDT!,
              holders['USDTe'],
              avUSDTAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('avWAVAX -> WAVAX', async () => {
            await testE2E(
              avWAVAX!,
              WAVAX,
              holders['avWAVAX'],
              avaxAmount,
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
