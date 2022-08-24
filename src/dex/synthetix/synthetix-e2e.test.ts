import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

const dexKey = 'Synthetix';

async function testForNetwork(
  network: Network,
  tokenChainlinkSymbol: string,
  tokenDexAggregatorSymbol: string,
  sUSDSymbol: string,
  tokenChainlinkAmount: string,
  tokenDexAggregatorAmount: string,
  sUSDAmount: string,
) {
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
  ]);

  sideToContractMethods.forEach((contractMethods, side) =>
    contractMethods.forEach((contractMethod: ContractMethod) => {
      describe(`${contractMethod}`, () => {
        it(`${network} ${side} ${contractMethod} ${sUSDSymbol} -> ${tokenChainlinkSymbol}`, async () => {
          await testE2E(
            tokens[sUSDSymbol],
            tokens[tokenChainlinkSymbol],
            holders[sUSDSymbol],
            side === SwapSide.SELL ? sUSDAmount : tokenChainlinkAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} ${sUSDSymbol} -> ${tokenDexAggregatorSymbol}`, async () => {
          await testE2E(
            tokens[sUSDSymbol],
            tokens[tokenDexAggregatorSymbol],
            holders[sUSDSymbol],
            side === SwapSide.SELL ? sUSDAmount : tokenDexAggregatorAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} ${tokenChainlinkSymbol} -> ${sUSDSymbol}`, async () => {
          await testE2E(
            tokens[tokenChainlinkSymbol],
            tokens[sUSDSymbol],
            holders[tokenChainlinkSymbol],
            side === SwapSide.SELL ? tokenChainlinkAmount : sUSDAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} ${tokenDexAggregatorSymbol} -> ${sUSDSymbol}`, async () => {
          await testE2E(
            tokens[tokenDexAggregatorSymbol],
            tokens[sUSDSymbol],
            holders[tokenDexAggregatorSymbol],
            side === SwapSide.SELL ? tokenDexAggregatorAmount : sUSDAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} ${tokenChainlinkSymbol} -> ${tokenDexAggregatorSymbol}`, async () => {
          await testE2E(
            tokens[tokenChainlinkSymbol],
            tokens[tokenDexAggregatorSymbol],
            holders[tokenChainlinkSymbol],
            side === SwapSide.SELL
              ? tokenChainlinkAmount
              : tokenDexAggregatorAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} ${tokenDexAggregatorSymbol} -> ${tokenChainlinkSymbol}`, async () => {
          await testE2E(
            tokens[tokenDexAggregatorSymbol],
            tokens[tokenChainlinkSymbol],
            holders[tokenDexAggregatorSymbol],
            side === SwapSide.SELL
              ? tokenDexAggregatorAmount
              : tokenChainlinkAmount,
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
}

describe('Synthetix E2E', () => {
  describe('Synthetix MAINNET', () => {
    const network = Network.MAINNET;

    const tokenChainlinkSymbol = 'sETH';
    const tokenDexAggregatorSymbol = 'sBTC';
    const sUSDSymbol = 'sUSD';

    const tokenChainlinkAmount = '1000000000000000000';
    const tokenDexAggregatorAmount = '1000000000000000000';
    const sUSDAmount = '1000000000000000000';

    testForNetwork(
      network,
      tokenChainlinkSymbol,
      tokenDexAggregatorSymbol,
      sUSDSymbol,
      tokenChainlinkAmount,
      tokenDexAggregatorAmount,
      sUSDAmount,
    );
  });

  // describe('Synthetix OPTIMISM', () => {
  //   const network = Network.OPTIMISM;

  //   const tokenChainlinkSymbol = 'sETH';
  //   const tokenDexAggregatorSymbol = 'sBTC';
  //   const sUSDSymbol = 'sUSD';

  //   const tokenChainlinkAmount = '1000000000000000000';
  //   const tokenDexAggregatorAmount = '1000000000000000000';
  //   const sUSDAmount = '1000000000000000000';

  //   testForNetwork(
  //     network,
  //     tokenChainlinkSymbol,
  //     tokenDexAggregatorSymbol,
  //     sUSDSymbol,
  //     tokenChainlinkAmount,
  //     tokenDexAggregatorAmount,
  //     sUSDAmount,
  //   );
  // });
});
