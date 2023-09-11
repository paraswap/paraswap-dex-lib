/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { ETHER_ADDRESS, Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Smardex } from './smardex';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

describe('Smardex', function () {
  const dexKey = 'Smardex';
  const network = Network.MAINNET;
  const tokens = Tokens[network];

  describe('Ethereum', () => {
    let dexHelper: DummyDexHelper;
    let blocknumber: number;

    beforeEach(async () => {
      dexHelper = new DummyDexHelper(network);
      blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    });

    // Token pairs to test
    const tokenPairs = [
      { src: 'SDEX', dest: 'USDT' },
      { src: 'SDEX', dest: 'WETH' },
      { src: 'SDEX', dest: 'ETH' },
    ] as { src: string; dest: string }[];

    /**
     * Allow to generate amounts for a pair of tokens according to the decimals of each token
     * Note: The amounts must increase at the same interval (e.g. 1000, 2000, 3000, 4000)
     */
    const generateAmountsForPair = (
      sellToken: string,
      buyToken: string,
      sellMultipliers: number[],
      buyMultipliers: number[],
    ) => {
      const sell = sellMultipliers.map(
        multiplier => BigInt(multiplier) * BI_POWS[tokens[sellToken].decimals],
      );
      const buy = buyMultipliers.map(
        multiplier => BigInt(multiplier) * BI_POWS[tokens[buyToken].decimals],
      );
      return { sell, buy };
    };

    const amounts = {
      'SDEX-USDT': generateAmountsForPair(
        'SDEX',
        'USDT',
        [0, 10_000, 20_000, 30_000],
        [0, 1_000, 2_000, 3_000],
      ),
      'SDEX-WETH': generateAmountsForPair(
        'SDEX',
        'WETH',
        [0, 100_000, 200_000, 300_000],
        [0, 1, 2, 3],
      ),
      'SDEX-ETH': generateAmountsForPair(
        'SDEX',
        'WETH',
        [0, 100_000, 200_000, 300_000],
        [0, 1, 2, 3],
      ),
    } as { [key: string]: { sell: bigint[]; buy: bigint[] } };

    // Help us to test the pool prices and volume for a given amount of tokens to swap
    const testPoolPricesVolume = async (swapSide: SwapSide, pair: any) => {
      const smardex = new Smardex(network, dexKey, dexHelper);
      const currentAmounts =
        swapSide === SwapSide.SELL
          ? amounts[`${pair.src}-${pair.dest}`].sell
          : amounts[`${pair.src}-${pair.dest}`].buy;

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
