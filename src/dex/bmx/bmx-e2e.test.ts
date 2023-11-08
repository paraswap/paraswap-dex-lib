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

describe('BMX E2E', () => {
  const dexKey = 'Bmx';

  describe('BMX Base', () => {
    const network = Network.BASE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDbC';
    const nativeTokenSymbol = NativeTokenSymbols[network];

    const tokenAAmount: string = '500000000'; // 500 USDC
    const tokenBAmount: string = '500000000'; // 500 USDC by Coinbase
    const nativeTokenAmount = '1000000000000000000'; // 1 ETH

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          // ContractMethod.multiSwap,
          // ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it(nativeTokenSymbol + ' -> TOKEN', async () => {
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
          it('TOKEN -> ' + nativeTokenSymbol, async () => {
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

  describe('WBLT Base', () => {
    const network = Network.BASE;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'WBLT';
    const nativeTokenSymbol = NativeTokenSymbols[network];

    const tokenABigAmount: string = '500000000000'; // 500_000 USDC
    const tokenAAmount: string = '10000000000'; // 10_000 USDC
    const tokenBAmount: string = '10000000000000000000000'; // 10_000 WBLT
    const nativeTokenAmount = '100000000000000000000'; // 100 ETH

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          // ContractMethod.multiSwap,
          // ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it(nativeTokenSymbol + ' -> WBLT', async () => {
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
          it('USDC -> WBLT', async () => {
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
          it('BIG SIZE USDC -> WBLT', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[tokenBSymbol],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenABigAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
          it('WBLT -> ' + nativeTokenSymbol, async () => {
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
          it('WBLT -> USDC', async () => {
            await testE2E(
              tokens[tokenBSymbol],
              tokens[tokenASymbol],
              holders[tokenBSymbol],
              side === SwapSide.SELL ? tokenBAmount : tokenASymbol,
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
