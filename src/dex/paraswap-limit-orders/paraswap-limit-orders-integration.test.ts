import dotenv from 'dotenv';
dotenv.config();

import {
  DummyDexHelper,
  DummyLimitOrderProvider,
} from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { ParaSwapLimitOrders } from './paraswap-limit-orders';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

const network = Network.ROPSTEN;
const TokenASymbol = 'WETH';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDC';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  10n * BI_POWS[TokenA.decimals],
  20n * BI_POWS[TokenA.decimals],
  30n * BI_POWS[TokenA.decimals],
];

const amountsBuy = [
  0n,
  100n * BI_POWS[TokenB.decimals],
  1100n * BI_POWS[TokenB.decimals],
  11000n * BI_POWS[TokenB.decimals],
];

const expectedPricesOnSell = [0n, 39130434n];

const expectedPricesOnBuy = [];

const dexKey = 'ParaSwapLimitOrders';

const tokenABKey = DummyLimitOrderProvider.getOrderBookCacheKey(
  network,
  TokenA.address,
  TokenB.address,
);

const dummyOrderBook = {
  [tokenABKey]: [
    // Orders: Maker = USDC, Taker = WETH
    {
      swappableMakerBalance: (1000n * BI_POWS[TokenB.decimals]).toString(),
      swappableTakerBalance: (2n * BI_POWS[TokenA.decimals]).toString(),
    },
    {
      swappableMakerBalance: (10000n * BI_POWS[TokenB.decimals]).toString(),
      swappableTakerBalance: (23n * BI_POWS[TokenA.decimals]).toString(),
    },
    {
      swappableMakerBalance: (100000n * BI_POWS[TokenB.decimals]).toString(),
      swappableTakerBalance: (234n * BI_POWS[TokenA.decimals]).toString(),
    },
  ],
};

describe('ParaSwapLimitOrders', function () {
  let dummyLimitOrderProvider: DummyLimitOrderProvider;
  let dexHelper: DummyDexHelper;
  let blockNumber: number;
  let paraSwapLimitOrders: ParaSwapLimitOrders;

  beforeAll(async () => {
    dexHelper = new DummyDexHelper(network);
    blockNumber = await dexHelper.provider.getBlockNumber();
    paraSwapLimitOrders = new ParaSwapLimitOrders(network, dexKey, dexHelper);
    dummyLimitOrderProvider = new DummyLimitOrderProvider();
    dummyLimitOrderProvider.setOrderBook(
      network,
      TokenA.address,
      TokenB.address,
      dummyOrderBook[tokenABKey],
    );

    paraSwapLimitOrders.limitOrderProvider = dummyLimitOrderProvider;
  });

  it('getPoolIdentifiers and getPricesVolume SELL Unswappable amount', async function () {
    const pools = await paraSwapLimitOrders.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await paraSwapLimitOrders.getPricesVolume(
      TokenA,
      TokenB,
      [260n * BI_POWS[TokenA.decimals]],
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices![0].prices[0].toString()).toEqual('0');
  });

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const pools = await paraSwapLimitOrders.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await paraSwapLimitOrders.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (paraSwapLimitOrders.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    // Check pricing values
    // for (let i = 0; i < expectedPricesOnSell.length; i++) {
    //   expect(poolPrices![0].prices[i].toString()).toEqual(
    //     expectedPricesOnSell[i].toString(),
    //   );
    // }
  });
  it('getPoolIdentifiers and getPricesVolume BUY Unswappable amount', async function () {
    const pools = await paraSwapLimitOrders.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await paraSwapLimitOrders.getPricesVolume(
      TokenA,
      TokenB,
      [2000n * BI_POWS[TokenB.decimals]],
      SwapSide.BUY,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices![0].prices[0].toString()).toEqual('0');
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const pools = await paraSwapLimitOrders.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await paraSwapLimitOrders.getPricesVolume(
      TokenA,
      TokenB,
      amountsBuy,
      SwapSide.BUY,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (paraSwapLimitOrders.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey, false);
    }
  });

  it('getTopPoolsForToken', async function () {
    // TODO: Add getTopPools when we support it
    // const poolLiquidity = await paraswapLimitOrders.getTopPoolsForToken(
    //   TokenA.address,
    //   10,
    // );
    // console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);
    // if (!paraswapLimitOrders.hasConstantPriceLargeAmounts) {
    //   checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    // }
  });
});
