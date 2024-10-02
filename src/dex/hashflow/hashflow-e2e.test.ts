import dotenv from 'dotenv';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {
  Holders,
  NativeTokenSymbols,
  Tokens,
} from '../../../tests/constants-e2e';
import { testE2E } from '../../../tests/utils-e2e';
import { generateConfig } from '../../config';
import { ContractMethod, Network, SwapSide } from '../../constants';

dotenv.config();

// Give time for rate fetcher to fill the cache
const sleepMs = 5000;

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
  excludeNativeTokenTests: boolean = false,
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
        ContractMethod.swapExactAmountIn,
        // ContractMethod.simpleSwap,
        // ContractMethod.multiSwap,
        // ContractMethod.megaSwap,
      ],
    ],
    // [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
    [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
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
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  sleepMs,
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
            }
          });
        });
      }),
    );
  });
}

describe('Hashflow E2E', () => {
  const dexKey = 'Hashflow';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    describe('USDT -> USDC', () => {
      const tokenASymbol: string = 'USDT';
      const tokenBSymbol: string = 'USDC';

      const tokenAAmount: string = '100000000';
      const tokenBAmount: string = '100000000';
      const nativeTokenAmount = '100000000000000000';

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

    describe('WETH -> USDC', () => {
      const tokenASymbol: string = 'WETH';
      const tokenBSymbol: string = 'USDC';

      const tokenAAmount: string = '100000000000000000';
      const tokenBAmount: string = '1000000';
      const nativeTokenAmount = '100000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        nativeTokenAmount,
        true,
      );

      // it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
      //   await testE2E(
      //     tokens[tokenASymbol],
      //     tokens[tokenBSymbol],
      //     holders[tokenASymbol],
      //     tokenAAmount,
      //     SwapSide.SELL,
      //     dexKey,
      //     ContractMethod.megaSwap,
      //     network,
      //     provider,
      //     undefined,
      //     undefined,
      //     undefined,
      //     undefined,
      //     sleepMs,
      //   );
      // });
      //
      // it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
      //   await testE2E(
      //     tokens[tokenBSymbol],
      //     tokens[tokenASymbol],
      //     holders[tokenBSymbol],
      //     tokenBAmount,
      //     SwapSide.SELL,
      //     dexKey,
      //     ContractMethod.megaSwap,
      //     network,
      //     provider,
      //     undefined,
      //     undefined,
      //     undefined,
      //     undefined,
      //     sleepMs,
      //   );
      // });
    });

    describe('DAI -> USDC', () => {
      const tokenASymbol: string = 'DAI';
      const tokenBSymbol: string = 'USDC';

      const tokenAAmount: string = '100000000000000000000';
      const tokenBAmount: string = '100000000';
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

    describe('Multiswap', () => {
      it('USDC -> ETH -> DAI', async () => {
        const dexKeys = ['Hashflow'];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const slippage = undefined;

        const tokenASymbol: string = 'USDC';
        const tokenBSymbol: string = 'DAI';

        const tokenAAmount: string = '22943400';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const contractMethod = ContractMethod.swapExactAmountIn;
        const side = SwapSide.SELL;

        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
          false,
          [
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
            '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
          ],
        );
      });

      it('DAI -> ETH -> USDC', async () => {
        const dexKeys = ['Hashflow'];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const slippage = undefined;

        const tokenASymbol: string = 'DAI';
        const tokenBSymbol: string = 'ETH';

        const tokenAAmount: string = '22675013677618734169';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const contractMethod = ContractMethod.swapExactAmountIn;
        const side = SwapSide.SELL;

        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
          false,
          [
            '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
          ],
        );
      });

      it('DAI -> USDC -> WETH', async () => {
        const dexKeys = ['Hashflow'];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const slippage = undefined;

        const tokenASymbol: string = 'DAI';
        const tokenBSymbol: string = 'ETH';

        const tokenAAmount: string = '22675013677618734169';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const contractMethod = ContractMethod.swapExactAmountIn;
        const side = SwapSide.SELL;

        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
          false,
          [
            '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
          ],
        );
      });

      it('WETH -> USDC -> DAI', async () => {
        const dexKeys = ['Hashflow'];
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const slippage = undefined;

        const tokenASymbol: string = 'WETH';
        const tokenBSymbol: string = 'DAI';

        const tokenAAmount: string = '8878957204610561';

        const tokens = Tokens[network];
        const holders = Holders[network];
        const contractMethod = ContractMethod.swapExactAmountIn;
        const side = SwapSide.SELL;

        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          tokenAAmount,
          side,
          dexKeys,
          contractMethod,
          network,
          provider,
          undefined,
          undefined,
          undefined,
          slippage,
          2000,
          false,
          [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
          ],
        );
      });
    });
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;

    const tokenASymbol: string = 'USDCe';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '10000000';
    const tokenBAmount: string = '10000000';
    const nativeTokenAmount = '100000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      // true,
    );
  });

  describe('BSC', () => {
    const network = Network.BSC;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '1000000000000000000';
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

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '10000000';
    const tokenBAmount: string = '10000000';
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

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDT';

    const tokenAAmount: string = '100000000';
    const tokenBAmount: string = '100000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      '0',
      true,
    );
  });
  describe('Avalanche', () => {
    const network = Network.AVALANCHE;

    const tokenASymbol: string = 'WAVAX';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '1000000';
    const nativeTokenAmount = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      nativeTokenAmount,
      true,
    );
  });
});
