import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Inception } from './inception';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { InceptionConfig } from './config';

const network = Network.MAINNET;
const dexKey = 'InceptionLRT';
const dexHelper = new DummyDexHelper(network);

describe('Inception', function () {
  let blockNumber: number;
  let inception: Inception;

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    inception = new Inception(network, dexKey, dexHelper);
    await inception.initializePricing(blockNumber);
  });

  InceptionConfig[dexKey][network].forEach(Pair => {
    const TokenASymbol = Pair.baseTokenSlug;
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = Pair.symbol;
    const TokenB = Tokens[network][TokenBSymbol];
    const TokenBAmounts = [0n, BI_POWS[6], 2000000n];

    describe(`deposit() Swap Function for ${TokenBSymbol} <> ${TokenASymbol}`, () => {
      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        const pools = await inception.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await inception.getPricesVolume(
          TokenB,
          TokenA,
          TokenBAmounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );
        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();
        checkPoolPrices(poolPrices!, TokenBAmounts, SwapSide.SELL, dexKey);
      });

      it('getTopPoolsForToken', async function () {
        const poolLiquidity = await inception.getTopPoolsForToken(
          TokenA.address,
          10,
        );

        checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
      });
    });
  });
});
