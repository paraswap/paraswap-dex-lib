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

describe('CurveV1 E2E', () => {
  const dexKey = 'CurveV1';

  describe('CurveV1 MAINNET', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'DAI';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

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
          it('TOKEN -> TOKEN', async () => {
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
      }),
    );
  });
});

describe('Acryptos E2E', () => {
  const dexKey = 'Acryptos';

  describe('Acryptos BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'DAI';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

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
          it('TOKEN -> TOKEN', async () => {
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
      }),
    );
  });
});

describe('Ellipsis E2E', () => {
  const dexKey = 'Ellipsis';

  describe('Ellipsis BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'BUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

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
          it('TOKEN -> TOKEN', async () => {
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
      }),
    );
  });
});

describe('Ellipsis E2E', () => {
  const dexKey = 'Ellipsis';

  describe('Ellipsis BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'BUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

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
          it('TOKEN -> TOKEN', async () => {
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
      }),
    );
  });
});

describe('Beltfi E2E', () => {
  const dexKey = 'Beltfi';

  describe('Beltfi BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'BUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

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
          it('TOKEN -> TOKEN', async () => {
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
      }),
    );
  });
});

describe('Swerve E2E', () => {
  const dexKey = 'Swerve';

  describe('Swerve Mainnet', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

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
          it('TOKEN -> TOKEN', async () => {
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
      }),
    );
  });
});
