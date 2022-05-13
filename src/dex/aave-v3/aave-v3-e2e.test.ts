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
import { getTokenFromASymbol } from './tokens';
import { Token } from '../../types';
import { generateConfig } from '../../config';

jest.setTimeout(1000 * 60 * 3);

describe('AaveV3 E2E', () => {
  const dexKey = 'AaveV3';

  describe('AaveV3 POLYGON', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).httpProvider,
      network,
    );

    const pairs = [
      {
        tokenSymbol: 'USDT',
        aTokenSymbol: 'aPolUSDT',
        amount: '1000000',
        aToken: getTokenFromASymbol(network, 'aUSDT'),
      },
      {
        tokenSymbol: 'MATIC',
        aTokenSymbol: 'aPolWMATIC',
        amount: '1000000000000000000',
        aToken: getTokenFromASymbol(network, 'aWMATIC'),
      },
      {
        tokenSymbol: 'WMATIC',
        aTokenSymbol: 'aPolWMATIC',
        amount: '1000000000000000000',
        aToken: getTokenFromASymbol(network, 'aWMATIC'),
      },
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    pairs.forEach(pair => {
      let aToken: Token;

      if (!pair.aToken) {
        expect(pair.aToken).not.toBeNull();
        return;
      } else aToken = pair.aToken;

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(pair.aTokenSymbol + ' -> ' + pair.tokenSymbol, async () => {
              await testE2E(
                aToken,
                tokens[pair.tokenSymbol],
                holders[pair.aTokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });

            it(pair.tokenSymbol + ' -> ' + pair.aTokenSymbol, async () => {
              await testE2E(
                tokens[pair.tokenSymbol],
                aToken,
                holders[pair.tokenSymbol],
                pair.amount,
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

  describe('AaveV3 FANTOM', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).httpProvider,
      network,
    );

    const pairs = [
      {
        tokenSymbol: 'FUSDT',
        aTokenSymbol: 'aFanUSDT',
        amount: '1000000',
        aToken: getTokenFromASymbol(network, 'aUSDT'),
      },
      {
        tokenSymbol: 'FTM',
        aTokenSymbol: 'aFanWFTM',
        amount: '1000000000000000000',
        aToken: getTokenFromASymbol(network, 'aWFTM'),
      },
      {
        tokenSymbol: 'WFTM',
        aTokenSymbol: 'aFanWFTM',
        amount: '1000000000000000000',
        aToken: getTokenFromASymbol(network, 'aWFTM'),
      },
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    pairs.forEach(pair => {
      let aToken: Token;

      if (!pair.aToken) {
        expect(pair.aToken).not.toBeNull();
        return;
      } else aToken = pair.aToken;

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(pair.aTokenSymbol + ' -> ' + pair.tokenSymbol, async () => {
              await testE2E(
                aToken,
                tokens[pair.tokenSymbol],
                holders[pair.aTokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });

            it(pair.tokenSymbol + ' -> ' + pair.aTokenSymbol, async () => {
              await testE2E(
                tokens[pair.tokenSymbol],
                aToken,
                holders[pair.tokenSymbol],
                pair.amount,
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

  describe('AaveV3 AVALANCHE', () => {
    const network = Network.AVALANCHE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).httpProvider,
      network,
    );

    const pairs = [
      {
        tokenSymbol: 'USDt',
        aTokenSymbol: 'aAvaUSDT',
        amount: '1000000',
        aToken: getTokenFromASymbol(network, 'aUSDT'),
      },
      {
        tokenSymbol: 'AVAX',
        aTokenSymbol: 'aAvaWAVAX',
        amount: '1000000000000000000',
        aToken: getTokenFromASymbol(network, 'aWAVAX'),
      },
      {
        tokenSymbol: 'WAVAX',
        aTokenSymbol: 'aAvaWAVAX',
        amount: '1000000000000000000',
        aToken: getTokenFromASymbol(network, 'aWAVAX'),
      },
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    pairs.forEach(pair => {
      let aToken: Token;

      if (!pair.aToken) {
        expect(pair.aToken).not.toBeNull();
        return;
      } else aToken = pair.aToken;

      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(pair.aTokenSymbol + ' -> ' + pair.tokenSymbol, async () => {
              await testE2E(
                aToken,
                tokens[pair.tokenSymbol],
                holders[pair.aTokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });

            it(pair.tokenSymbol + ' -> ' + pair.aTokenSymbol, async () => {
              await testE2E(
                tokens[pair.tokenSymbol],
                aToken,
                holders[pair.tokenSymbol],
                pair.amount,
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
});
