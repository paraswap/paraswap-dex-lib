/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { ETHER_ADDRESS, Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Smardex } from './smardex';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

interface NetworkConfig {
  name: 'ethereum' | 'bsc' | 'polygon' | 'arbitrum';
  network: Network;
  tokens: typeof Tokens[Network];
  tokenPairs: { src: string; dest: string; sell: number[]; buy: number[] }[];
}

const networkConfigs: Array<NetworkConfig> = [
  {
    name: 'ethereum',
    network: Network.MAINNET,
    tokens: Tokens[Network.MAINNET],
    tokenPairs: [
      {
        src: 'SDEX',
        dest: 'USDT',
        sell: [0, 10_000, 20_000, 30_000],
        buy: [0, 1_000, 2_000],
      },
      {
        src: 'SDEX',
        dest: 'WETH',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 1, 2, 3],
      },
      {
        src: 'SDEX',
        dest: 'ETH',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 1, 2, 3],
      },
      { src: 'WETH', dest: 'WBTC', sell: [0, 2, 4, 6], buy: [0, 1, 2, 3] },
    ],
  },
  {
    name: 'arbitrum',
    network: Network.ARBITRUM,
    tokens: Tokens[Network.ARBITRUM],
    tokenPairs: [
      {
        src: 'SDEX',
        dest: 'USDC',
        sell: [0, 10_000, 20_000, 30_000],
        buy: [0, 1_000, 2_000],
      },
      {
        src: 'SDEX',
        dest: 'WETH',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 1, 2, 3],
      },
      {
        src: 'SDEX',
        dest: 'ETH',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 1, 2, 3],
      },
      {
        src: 'SDEX',
        dest: 'WBTC',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 1, 2, 3],
      },
      {
        src: 'ARB',
        dest: 'USDC',
        sell: [0, 2_000, 4_000, 6_000],
        buy: [0, 1_000, 2_000],
      },
    ],
  },
  {
    name: 'bsc',
    network: Network.BSC,
    tokens: Tokens[Network.BSC],
    tokenPairs: [
      {
        src: 'SDEX',
        dest: 'USDT',
        sell: [0, 10_000, 20_000, 30_000],
        buy: [0, 1_000, 2_000],
      },
      {
        src: 'bBTC',
        dest: 'SDEX',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 1, 2, 3],
      },
      {
        src: 'USDT',
        dest: 'WBNB',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 10, 20, 30],
      },
      { src: 'ETH', dest: 'SDEX', sell: [0, 2, 4, 6], buy: [0, 1, 2, 3] },
      {
        src: 'USDT',
        dest: 'BNB',
        sell: [0, 2_000, 4_000, 6_000],
        buy: [0, 10, 20, 30],
      },
    ],
  },
  {
    name: 'polygon',
    network: Network.POLYGON,
    tokens: Tokens[Network.POLYGON],
    tokenPairs: [
      {
        src: 'USDC',
        dest: 'SDEX',
        sell: [0, 10_000, 20_000, 30_000],
        buy: [0, 100_000, 200_000],
      },
      {
        src: 'SDEX',
        dest: 'WETH',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 2, 4, 6, 8, 10],
      },
      {
        src: 'USDC',
        dest: 'WMATIC',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 20_000, 40_000, 60_000],
      },
      {
        src: 'USDC',
        dest: 'MATIC',
        sell: [0, 100_000, 200_000, 300_000],
        buy: [0, 20_000, 40_000, 60_000],
      },
      {
        src: 'WBTC',
        dest: 'SDEX',
        sell: [0, 1, 2, 3],
        buy: [0, 500_000, 1_000_000, 1_500_000],
      },
    ],
  },
];

networkConfigs.forEach(({ name, network, tokens, tokenPairs }) => {
  describe(`Smardex Integration Tests on ${name}`, () => {
    const dexKey = 'Smardex';

    let dexHelper: DummyDexHelper;
    let blocknumber: number;

    beforeEach(async () => {
      dexHelper = new DummyDexHelper(network);
      blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    });

    // Help us to test the pool prices and volume for a given amount of tokens to swap
    const testPoolPricesVolume = async (swapSide: SwapSide, pair: any) => {
      const smardex = new Smardex(network, dexKey, dexHelper);
      const currentAmounts =
        swapSide === SwapSide.SELL
          ? pair.sell.map(
              (amount: number) =>
                BigInt(amount) * BI_POWS[tokens[pair.src].decimals],
            )
          : pair.buy.map(
              (amount: number) =>
                BigInt(amount) * BI_POWS[tokens[pair.dest].decimals],
            );

      const pools = await smardex.getPoolIdentifiers(
        tokens[pair.src],
        tokens[pair.dest],
        swapSide,
        blocknumber,
      );
      console.log(`${pair.src} <> ${pair.dest} Pool Identifiers: `, pools);
      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await smardex.getPricesVolume(
        tokens[pair.src],
        tokens[pair.dest],
        currentAmounts,
        swapSide,
        blocknumber,
        pools,
      );
      console.log(`${pair.src} <> ${pair.dest} Pool Prices: `, poolPrices);
      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, currentAmounts, swapSide, dexKey);
    };

    /**
     * For each token pair, test:
     * - Compute pool identifiers and prices for a given amount of tokens to swap (SELL and BUY)
     * - Get top pools for a token
     */
    tokenPairs.forEach(pair => {
      describe(`${pair.src} <> ${pair.dest}`, () => {
        it('SELL: Compute pool identiers and prices', async () => {
          await testPoolPricesVolume(SwapSide.SELL, pair);
        });

        it('BUY: Compute pool identiers and prices', async () => {
          await testPoolPricesVolume(SwapSide.BUY, pair);
        });
      });
    });

    it('getTopPoolsForToken', async () => {
      const smardex = new Smardex(network, dexKey, dexHelper);
      // Get all distinct tokens of the pairs
      const distinctTokens = tokenPairs
        .reduce((acc, pair) => [...acc, pair.src, pair.dest], [] as string[])
        .filter((value, index, self) => self.indexOf(value) === index)
        // Native token doesn't have a pool, avoid it
        .filter(token => tokens[token].address !== ETHER_ADDRESS);
      // Get top pools for each token and check liquidity
      await Promise.all(
        distinctTokens.map(async token =>
          checkPoolsLiquidity(
            await smardex.getTopPoolsForToken(tokens[token].address, 10),
            tokens[token].address,
            dexKey,
          ),
        ),
      );
    });
  });
});
