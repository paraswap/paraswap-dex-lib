import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Camelot E2E', () => {
  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe(`Camelot`, () => {
      const dexKey = 'Camelot';

      describe(`simpleSwap`, () => {
        describe(`Volatile`, () => {
          describe(`SELL`, () => {
            it('ETH -> USDC', async () => {
              await testE2E(
                tokens.ETH,
                tokens.USDC,
                holders.ETH,
                '1000000000000000000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.simpleSwap,
                network,
                provider,
              );
            });
            it('ETH -> USDC', async () => {
              await testE2E(
                tokens.ETH,
                tokens.USDC,
                holders.ETH,
                '1100000000000000000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.simpleSwap,
                network,
                provider,
              );
            });
            it('USDC -> ETH', async () => {
              await testE2E(
                tokens.USDC,
                tokens.ETH,
                holders.USDC,
                '100000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.simpleSwap,
                network,
                provider,
              );
            });
            it('USDC -> WETH', async () => {
              await testE2E(
                tokens.USDC,
                tokens.WETH,
                holders.USDC,
                '10000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.simpleSwap,
                network,
                provider,
              );
            });
          });
          describe(`BUY`, () => {
            it('ETH -> USDC', async () => {
              await testE2E(
                tokens.ETH,
                tokens.USDC,
                holders.ETH,
                '10000',
                SwapSide.BUY,
                dexKey,
                ContractMethod.simpleBuy,
                network,
                provider,
              );
            });
            it('ETH -> USDC', async () => {
              await testE2E(
                tokens.ETH,
                tokens.USDC,
                holders.ETH,
                '11000',
                SwapSide.BUY,
                dexKey,
                ContractMethod.simpleBuy,
                network,
                provider,
              );
            });
            it('USDC -> ETH', async () => {
              await testE2E(
                tokens.USDC,
                tokens.ETH,
                holders.USDC,
                '100000',
                SwapSide.BUY,
                dexKey,
                ContractMethod.simpleBuy,
                network,
                provider,
              );
            });
            it('USDC -> WETH', async () => {
              await testE2E(
                tokens.USDC,
                tokens.WETH,
                holders.USDC,
                '100000',
                SwapSide.BUY,
                dexKey,
                ContractMethod.simpleBuy,
                network,
                provider,
              );
            });
          });
        });
        describe(`Stable`, () => {
          describe(`SELL`, () => {
            it('USDC -> DAI', async () => {
              await testE2E(
                tokens.USDC,
                tokens.DAI,
                holders.USDC,
                '100000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.simpleSwap,
                network,
                provider,
              );
            });
          });
        });
      });
      describe(`multiSwap`, () => {
        describe(`Volatile`, () => {
          it('ETH -> USDC', async () => {
            await testE2E(
              tokens.ETH,
              tokens.USDC,
              holders.ETH,
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('ETH -> USDC', async () => {
            await testE2E(
              tokens.ETH,
              tokens.USDC,
              holders.ETH,
              '11000000000000000000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('USDC -> ETH', async () => {
            await testE2E(
              tokens.USDC,
              tokens.ETH,
              holders.USDC,
              '110000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
          it('USDC -> WETH', async () => {
            await testE2E(
              tokens.USDC,
              tokens.WETH,
              holders.USDC,
              '100000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
        describe(`Stable`, () => {
          it('USDC -> DAI', async () => {
            await testE2E(
              tokens.USDC,
              tokens.DAI,
              holders.USDC,
              '100000',
              SwapSide.SELL,
              dexKey,
              ContractMethod.multiSwap,
              network,
              provider,
            );
          });
        });
      });
    });
  });
});
