/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenCSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  tokenCAmount: string,
  nativeTokenAmount: string,
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

  describe(`Network id: ${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            describe('Real pools', () => {
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
                );
              });
              it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
                await testE2E(
                  tokens[tokenASymbol],
                  tokens[nativeTokenSymbol],
                  holders[tokenASymbol],
                  side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
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
                );
              });
            });
            describe('Virtual pools', () => {
              it(`${nativeTokenSymbol} -> ${tokenCSymbol}`, async () => {
                await testE2E(
                  tokens[nativeTokenSymbol],
                  tokens[tokenCSymbol],
                  holders[nativeTokenSymbol],
                  side === SwapSide.SELL ? nativeTokenAmount : tokenCAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
              it(`${tokenCSymbol} -> ${nativeTokenSymbol}`, async () => {
                await testE2E(
                  tokens[tokenCSymbol],
                  tokens[nativeTokenSymbol],
                  holders[tokenCSymbol],
                  side === SwapSide.SELL ? tokenCAmount : nativeTokenAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
              it(`${tokenASymbol} -> ${tokenCSymbol}`, async () => {
                await testE2E(
                  tokens[tokenASymbol],
                  tokens[tokenCSymbol],
                  holders[tokenASymbol],
                  side === SwapSide.SELL ? tokenAAmount : tokenCAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
            });
          });
        });
      }),
    );
  });
}

describe('VirtuSwap E2E', () => {
  const dexKey = 'VirtuSwap';
  const networks = [Network.POLYGON, Network.ARBITRUM];

  for (const network of networks) {
    const tokenASymbol: string = 'VRSW';
    const tokenBSymbol: string = Tokens[network]['USDCe'] ? 'USDCe' : 'USDC';
    const tokenCSymbol: string = 'USDT'; // 3rd token to test virtual pools

    const tokenAAmount: string = '10000000000000000000';
    const tokenBAmount: string = (
      100n * BI_POWS[Tokens[network][tokenBSymbol].decimals]
    ).toString();
    const tokenCAmount: string = '1000000';
    const nativeTokenAmount: string =
      NativeTokenSymbols[network] === 'ETH'
        ? '1000000000000000'
        : '100000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenCSymbol,
      tokenAAmount,
      tokenBAmount,
      tokenCAmount,
      nativeTokenAmount,
    );
  }
});
