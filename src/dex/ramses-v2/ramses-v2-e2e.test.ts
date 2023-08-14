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

describe('RamsesV2 E2E', () => {
  const dexKey = 'RamsesV2';

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDCe';
    const tokenBSymbol: string = 'USDT';
    const nativeTokenSymbol = NativeTokenSymbols[network];

    const tokenAAmount: string = '11000000';
    const tokenBAmount: string = '21000000';
    const nativeTokenAmount = '11000000000000000000';

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          // ContractMethod.multiSwap,
          // ContractMethod.megaSwap,
          // ContractMethod.directUniV3Swap,
        ],
      ],
      // [
      //   SwapSide.BUY,
      //   [
      //     ContractMethod.simpleBuy,
      //     ContractMethod.buy,
      //     ContractMethod.directUniV3Buy,
      //   ],
      // ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          // it(`${network} ${side} ${contractMethod} ${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
          //   await testE2E(
          //     tokens[nativeTokenSymbol],
          //     tokens[tokenASymbol],
          //     holders[nativeTokenSymbol],
          //     side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
          //     side,
          //     dexKey,
          //     contractMethod,
          //     network,
          //     provider,
          //   );
          // });
          // it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
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
          //   );
          // });
          it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
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
