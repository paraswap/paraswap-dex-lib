import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

const sleepMs: number = 5000;

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
  excludeNativeTokenTests: boolean = true,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];
  const nativeTokenSymbol = NativeTokenSymbols[network];

  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
    [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            if (excludeNativeTokenTests) {
              it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
                await testE2E(
                  tokens[tokenASymbol],
                  tokens[tokenBSymbol],
                  holders[tokenASymbol],
                  side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  sleepMs,
                );
              });
              it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
                await testE2E(
                  tokens[tokenBSymbol],
                  tokens[tokenASymbol],
                  holders[tokenBSymbol],
                  side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  sleepMs,
                );
              });
            } else {
              it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
                await testE2E(
                  tokens[nativeTokenSymbol],
                  tokens[tokenASymbol],
                  holders[nativeTokenSymbol],
                  side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  sleepMs,
                );
              });
              // it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
              //   await testE2E(
              //     tokens[tokenASymbol],
              //     tokens[nativeTokenSymbol],
              //     holders[tokenASymbol],
              //     side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
              //     side,
              //     dexKey,
              //     contractMethod,
              //     network,
              //     provider,
              //     undefined,
              //     undefined,
              //     undefined,
              //     undefined,
              //     sleepMs,
              //   );
              // });
            }
          });
        });
      }),
    );
  });
}

describe('SwaapV2 E2E', () => {
  const dexKey = 'SwaapV2';

  describe('Polygon', () => {
    const network = Network.POLYGON;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'WETH';

    const tokenAAmount: string = '100000000';
    const tokenBAmount: string = '100000000000000000';
    const nativeTokenAmount = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
    );
  });

  // Arbitrum will be supported later
  // describe('Arbitrum', () => {
  //   const network = Network.ARBITRUM;
  //
  //   const tokenASymbol: string = 'ETH';
  //   const tokenBSymbol: string = 'DAI';
  //
  //   const tokenAAmount: string = '100000000';
  //   const tokenBAmount: string = '1000000000000000000';
  //   const nativeTokenAmount = '1000000000000000000';
  //
  //   testForNetwork(
  //     network,
  //     dexKey,
  //     tokenASymbol,
  //     tokenBSymbol,
  //     tokenAAmount,
  //     tokenBAmount,
  //     nativeTokenAmount,
  //   );
  // });

  // Mainnet will be supported later
  // describe('Mainnet', () => {
  //   const network = Network.MAINNET;
  //   const tokenASymbol: string = 'USDC';
  //   const tokenBSymbol: string = 'USDT';
  //
  //   const tokenAAmount: string = '100000000';
  //   const tokenBAmount: string = '1000000000000000000';
  //   const nativeTokenAmount = '1000000000000000000';
  //
  //   testForNetwork(
  //     network,
  //     dexKey,
  //     tokenASymbol,
  //     tokenBSymbol,
  //     tokenAAmount,
  //     tokenBAmount,
  //     nativeTokenAmount,
  //   );
  // });
});
