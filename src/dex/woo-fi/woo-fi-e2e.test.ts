import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

const dexKey = 'WooFi';

async function testForNetwork(
  network: Network,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
) {
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(ProviderURL[network], network);
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
  ]);

  sideToContractMethods.forEach((contractMethods, side) =>
    contractMethods.forEach((contractMethod: ContractMethod) => {
      describe(`${contractMethod}`, () => {
        it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> QUOTE TOKEN`, async () => {
          await testE2E(
            tokens[nativeTokenSymbol],
            tokens[tokenBSymbol],
            holders[nativeTokenSymbol],
            side === SwapSide.SELL ? nativeTokenAmount : tokenBAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} QUOTE TOKEN -> ${nativeTokenSymbol}`, async () => {
          await testE2E(
            tokens[tokenBSymbol],
            tokens[nativeTokenSymbol],
            holders[tokenBSymbol],
            side === SwapSide.SELL ? tokenBAmount : nativeTokenAmount,
            side,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it(`${network} ${side} ${contractMethod} BASE TOKEN -> QUOTE TOKEN`, async () => {
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
        it(`${network} ${side} ${contractMethod} QUOTE TOKEN -> BASE TOKEN`, async () => {
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
          );
        });
      });
    }),
  );
}

describe('WooFi E2E', () => {
  describe('WooFi BSC', () => {
    const network = Network.BSC;

    const tokenASymbol: string = 'WBNB';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '3000000000000000000';
    const tokenBAmount: string = '111000000000000000000';
    const nativeTokenAmount = '3000000000000000000';

    testForNetwork(
      network,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
    );
  });

  describe('WooFi Avalanche', () => {
    const network = Network.AVALANCHE;

    const tokenASymbol: string = 'WAVAX';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '3000000000000000000';
    const tokenBAmount: string = '111000000';
    const nativeTokenAmount = '3000000000000000000';

    testForNetwork(
      network,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
    );
  });

  describe('WooFi Fantom', () => {
    const network = Network.FANTOM;

    const tokenASymbol: string = 'WFTM';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '333000000000000000000';
    const tokenBAmount: string = '111000000';
    const nativeTokenAmount = '333000000000000000000';

    testForNetwork(
      network,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
    );
  });

  describe('WooFi Polygon', () => {
    const network = Network.POLYGON;

    const tokenASymbol: string = 'WMATIC';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '3000000000000000000';
    const tokenBAmount: string = '1000000';
    const nativeTokenAmount = '3000000000000000000';

    testForNetwork(
      network,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
    );
  });
});
