import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Holders, Tokens } from '../../../tests/constants-e2e';
import { ContractMethod, Network, SwapSide } from '../../constants';
import { getRpcProvider } from '../../web3-provider';

describe('QuickSwap', () => {
  describe('Polygon', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = getRpcProvider(network);
    describe('QuickSwapV3', () => {
      const dexKey = 'QuickSwap';

      describe('Simpleswap', () => {
        it('QuickSwap MATIC -> TOKEN', async () => {
          await testE2E(
            tokens.MATIC,
            tokens.WETH,
            holders.MATIC,
            '7000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('QuickSwap TOKEN -> MATIC', async () => {
          await testE2E(
            tokens.DAI,
            tokens.MATIC,
            holders.DAI,
            '100000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('QuickSwap TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.WMATIC,
            tokens.WETH,
            holders.WMATIC,
            '7000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('Multiswap', () => {
        it('QuickSwap MATIC -> TOKEN', async () => {
          await testE2E(
            tokens.MATIC,
            tokens.WETH,
            holders.MATIC,
            '7000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
        it('QuickSwap TOKEN -> MATIC', async () => {
          await testE2E(
            tokens.DAI,
            tokens.MATIC,
            holders.DAI,
            '7000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
        it('QuickSwap TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.DAI,
            tokens.WMATIC,
            holders.DAI,
            '70000000000000000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.multiSwap,
            network,
            provider,
          );
        });
      });

      describe('BuyMethod', () => {
        it('QuickSwap MATIC -> TOKEN', async () => {
          await testE2E(
            tokens.MATIC,
            tokens.WETH,
            holders.MATIC,
            '7000000000000000000',
            SwapSide.BUY,
            dexKey,
            ContractMethod.buy,
            network,
            provider,
          );
        });
        it('QuickSwap TOKEN -> MATIC', async () => {
          await testE2E(
            tokens.DAI,
            tokens.MATIC,
            holders.DAI,
            '7000000000000000000',
            SwapSide.BUY,
            dexKey,
            ContractMethod.buy,
            network,
            provider,
          );
        });
        it('QuickSwap TOKEN -> TOKEN', async () => {
          await testE2E(
            tokens.DAI,
            tokens.WMATIC,
            holders.DAI,
            '70000000000000000000',
            SwapSide.BUY,
            dexKey,
            ContractMethod.buy,
            network,
            provider,
          );
        });
      });

      describe('FeeOnTransfer', () => {
        describe('sell', () => {
          describe('megaSwap', () => {
            it('WMATIC -> HANZO', async () => {
              await testE2E(
                tokens.WMATIC,
                tokens.HANZO,
                holders.WMATIC,
                '1000000000000000000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.megaSwap,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 0, srcDexFee: 0, destDexFee: 500 },
              );
            });
            it('HANZO -> WMATIC', async () => {
              await testE2E(
                tokens.HANZO,
                tokens.WMATIC,
                holders.HANZO,
                '41234567000000000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.megaSwap,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
              );
            });
          });
          describe('swapOnUniswapV2Fork', () => {
            it('WMATIC -> HANZO', async () => {
              await testE2E(
                tokens.WMATIC,
                tokens.HANZO,
                holders.WMATIC,
                '1000000000000000000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.swapOnUniswapV2Fork,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 0, srcDexFee: 0, destDexFee: 500 },
              );
            });
            it('HANZO -> WMATIC', async () => {
              await testE2E(
                tokens.HANZO,
                tokens.WMATIC,
                holders.HANZO,
                '41234567000000000',
                SwapSide.SELL,
                dexKey,
                ContractMethod.swapOnUniswapV2Fork,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
              );
            });
          });
        });
        describe('buy', () => {
          describe('buy', () => {
            it('HANZO -> WMATIC', async () => {
              await testE2E(
                tokens.HANZO,
                tokens.WMATIC,
                holders.HANZO,
                '1000000000000000000',
                SwapSide.BUY,
                dexKey,
                ContractMethod.buy,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
              );
            });
          });
          describe('buyOnUniswapV2Fork', () => {
            it('HANZO -> WMATIC', async () => {
              await testE2E(
                tokens.HANZO,
                tokens.WMATIC,
                holders.HANZO,
                '1000000000000000000',
                SwapSide.BUY,
                dexKey,
                ContractMethod.buyOnUniswapV2Fork,
                network,
                provider,
                undefined,
                undefined,
                { srcFee: 0, destFee: 0, srcDexFee: 500, destDexFee: 0 },
              );
            });
          });
        });
      });
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = getRpcProvider(network);
    describe('Zyberswapv3', () => {
      const dexKey = 'Zyberswapv3';

      describe('Simpleswap', () => {
        it('WETH -> USDC', async () => {
          await testE2E(
            tokens.WETH,
            tokens.USDC,
            holders.WETH,
            '7000000000000000000',
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
            '100000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
        it('WBTC -> USDC', async () => {
          await testE2E(
            tokens.WBTC,
            tokens.USDC,
            holders.WBTC,
            '10000000',
            SwapSide.SELL,
            dexKey,
            ContractMethod.simpleSwap,
            network,
            provider,
          );
        });
      });

      describe('Multiswap', () => {
        it('WETH -> USDC', async () => {
          await testE2E(
            tokens.WETH,
            tokens.USDC,
            holders.WETH,
            '7000000000000000000',
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
        it('WBTC -> USDC', async () => {
          await testE2E(
            tokens.WBTC,
            tokens.USDC,
            holders.WBTC,
            '10000000',
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

  describe('Fantom', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = getRpcProvider(network);
    describe('SpiritSwapV3', () => {
      const dexKey = 'SpiritSwapV3';

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

      const pairs: { name: string; sellAmount: string; buyAmount: string }[][] =
        [
          [
            {
              name: 'USDC',
              sellAmount: '100',
              buyAmount: '10000000000000000',
            },
            {
              name: 'WFTM',
              sellAmount: '10000000000000000',
              buyAmount: '100',
            },
          ],
          [
            {
              name: 'FTM',
              sellAmount: '1000000000000000',
              buyAmount: '100',
            },
            {
              name: 'USDC',
              sellAmount: '100',
              buyAmount: '10000000000000000',
            },
          ],
        ];

      sideToContractMethods.forEach((contractMethods, side) =>
        describe(`${side}`, () => {
          contractMethods.forEach((contractMethod: ContractMethod) => {
            pairs.forEach(pair => {
              describe(`${contractMethod}`, () => {
                it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                  await testE2E(
                    tokens[pair[0].name],
                    tokens[pair[1].name],
                    holders[pair[0].name],
                    side === SwapSide.SELL
                      ? pair[0].sellAmount
                      : pair[0].buyAmount,
                    side,
                    dexKey,
                    contractMethod,
                    network,
                    provider,
                  );
                });
                it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                  await testE2E(
                    tokens[pair[1].name],
                    tokens[pair[0].name],
                    holders[pair[1].name],
                    side === SwapSide.SELL
                      ? pair[1].sellAmount
                      : pair[1].buyAmount,
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
  });
});
