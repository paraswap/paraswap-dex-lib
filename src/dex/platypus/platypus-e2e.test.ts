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
import { StaticJsonRpcProvider } from '@ethersproject/providers';

describe('Platypus E2E', () => {
  const dexKey = 'Platypus';

  describe('Platypus AVALANCHE', () => {
    const network = Network.AVALANCHE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(ProviderURL[network], network);

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'DAIE';

    const tokenAAmount: string = '9999000000';
    const tokenBAmount: string = '9999000000000000000000';

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

    const poolTokenSymbols: string[] = [
      'newFRAX',
      'MIM',
      'YUSD',
      'H2O',
      'MONEY',
      'TSD',
    ];

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
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
            );
          });
          it(`AVAX -> sAVAX`, async () => {
            await testE2E(
              tokens['AVAX'],
              tokens['sAVAX'],
              holders['AVAX'],
              '999000000000000000000',
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it(`WAVAX -> sAVAX`, async () => {
            await testE2E(
              tokens['WAVAX'],
              tokens['sAVAX'],
              holders['WAVAX'],
              '999000000000000000000',
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it(`sAVAX -> AVAX`, async () => {
            await testE2E(
              tokens['sAVAX'],
              tokens['AVAX'],
              holders['sAVAX'],
              '999000000000000000000',
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it(`sAVAX -> WAVAX`, async () => {
            await testE2E(
              tokens['sAVAX'],
              tokens['WAVAX'],
              holders['sAVAX'],
              '999000000000000000000',
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          if (
            contractMethod === ContractMethod.simpleSwap &&
            side === SwapSide.SELL
          ) {
            poolTokenSymbols.forEach(poolTokenSymbol => {
              it(`${tokenASymbol} -> ${poolTokenSymbol}`, async () => {
                await testE2E(
                  tokens[tokenASymbol],
                  tokens[poolTokenSymbol],
                  holders[tokenASymbol],
                  tokenAAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              });
            });
          }
        });
      }),
    );

    it(`wBTC -> BTCb`, async () => {
      await testE2E(
        tokens['wBTC'],
        tokens['BTCb'],
        holders['wBTC'],
        '300000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
  });
});
