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
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];

  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
        ContractMethod.directCurveV1Swap,
      ],
    ],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[tokenBSymbol],
                holders[tokenASymbol],
                tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[tokenBSymbol],
                tokens[tokenASymbol],
                holders[tokenBSymbol],
                tokenBAmount,
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

describe('CurveV1Factory E2E', () => {
  const dexKey = 'CurveV1Factory';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'USDD';

    const tokenAAmount: string = '100000000';
    const tokenBAmount: string = '111000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
  describe('Mainnet Native', () => {
    const network = Network.MAINNET;

    const tokenASymbol: string = 'ETH';
    const tokenBSymbol: string = 'alETH';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
  describe('Polygon', () => {
    const network = Network.POLYGON;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'axlUSDC';

    const tokenAAmount: string = '111000000';
    const tokenBAmount: string = '111000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
  // We don't support in current implementation working on unwrapped asset with Zap
  // describe('Polygon deUSDC', () => {
  //   const network = Network.POLYGON;

  //   const tokenASymbol: string = 'deUSDC';
  //   const tokenBSymbol: string = 'USDT';

  //   const tokenAAmount: string = '111000000';
  //   const tokenBAmount: string = '111000000';

  //   testForNetwork(
  //     network,
  //     dexKey,
  //     tokenASymbol,
  //     tokenBSymbol,
  //     tokenAAmount,
  //     tokenBAmount,
  //   );
  // });

  describe('Polygon amUSDC', () => {
    const network = Network.POLYGON;

    const tokenASymbol: string = 'deUSDC';
    const tokenBSymbol: string = 'amUSDC';

    const tokenAAmount: string = '1000000';
    const tokenBAmount: string = '1000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });

  // Uncomment this when add support for unwrapping lending tokens
  // describe('Polygon MAI', () => {
  //   const network = Network.POLYGON;

  //   const tokenASymbol: string = 'MAI';
  //   const tokenBSymbol: string = 'USDC';

  //   const tokenAAmount: string = '11000000000000000000';
  //   const tokenBAmount: string = '11000000';

  //   testForNetwork(
  //     network,
  //     dexKey,
  //     tokenASymbol,
  //     tokenBSymbol,
  //     tokenAAmount,
  //     tokenBAmount,
  //   );
  // });

  describe('Avalanche', () => {
    const network = Network.AVALANCHE;

    const tokenASymbol: string = 'YUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '111000000000000000000';
    const tokenBAmount: string = '111000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
  describe('Fantom', () => {
    const network = Network.FANTOM;

    const tokenASymbol: string = 'TOR';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '111000000000000000000';
    const tokenBAmount: string = '111000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    const tokenASymbol: string = 'VST';
    const tokenBSymbol: string = 'FRAX';

    const tokenAAmount: string = '111000000000000000000';
    const tokenBAmount: string = '111000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    const tokenASymbol: string = 'sETH';
    const tokenBSymbol: string = 'ETH';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
});
