/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Integral } from './integral';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Token } from '../../types';
import { IntegralConfig } from './config';
import IntegralRelayerABI from '../../abi/integral/relayer.json';
import { Interface } from '@ethersproject/abi';
import { uint256ToBigInt } from '../../lib/decoders';
import { MultiCallParams } from '../../lib/multi-wrapper';

jest.setTimeout(50 * 1000);
const network = Network.MAINNET;
const testDatas: {
  tokenA: Token;
  tokenB: Token;
  block: number;
  data: number[];
}[] = [
  {
    tokenA: { symbol: 'USDC' } as Token,
    tokenB: { symbol: 'USDT' } as Token,
    block: 19608294,
    data: [
      0, 5100, 10200, 15300, 20400, 25500, 30600, 35700, 40800, 45900, 51000,
    ],
  },
  {
    tokenA: { symbol: 'USDT' } as Token,
    tokenB: { symbol: 'WETH' } as Token,
    block: 19831195,
    data: [0, 1.7, 3.4, 5.1, 6.8, 8.5, 10.2, 11.9, 13.6, 15.3, 17],
  },
];
initializeTokens();

const dexHelper = new DummyDexHelper(network);
const dexKey = 'Integral';

function initializeTokens() {
  for (const [i, testData] of testDatas.entries()) {
    const tokenA = Tokens[network][testData.tokenA.symbol!];
    const tokenB = Tokens[network][testData.tokenB.symbol!];
    tokenA.symbol = testData.tokenA.symbol;
    tokenB.symbol = testData.tokenB.symbol;
    testDatas[i].tokenA = tokenA;
    testDatas[i].tokenB = tokenB;
  }
}

function initializeAmounts(token: Token, units: number[]) {
  const precision = 10 ** 18;
  return units.map(
    unit =>
      (BigInt(unit * precision) * BI_POWS[token.decimals]) / BigInt(precision),
  );
}

async function checkOnChainPricing(
  relayerAddress: string,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  TokenA: Token,
  TokenB: Token,
  expectedAmounts: bigint[],
) {
  const relayerInterface = new Interface(IntegralRelayerABI);
  const callData = expectedAmounts
    .slice(1)
    .map<MultiCallParams<bigint>>(amount => ({
      target: relayerAddress,
      callData: relayerInterface.encodeFunctionData(funcName, [
        TokenA.address,
        TokenB.address,
        amount,
      ]),
      decodeFunction: uint256ToBigInt,
    }));
  const results = await dexHelper.multiWrapper.tryAggregate(
    false,
    callData,
    blockNumber,
    dexHelper.multiWrapper.defaultBatchSize,
    false,
  );

  const expectedPrices = [0n].concat(results.map(result => result.returnData));
  expect(prices).toEqual(expectedPrices);
}

for (const { tokenA, tokenB, data, block } of testDatas) {
  describe(`Integral Pool ${tokenB.symbol}-${tokenA.symbol}`, function () {
    let integral: Integral;

    beforeAll(async () => {
      integral = new Integral(network, dexKey, dexHelper);
      await integral.initializePricing(block);
    });

    it(`getPoolIdentifiers and getPricesVolume SELL [${tokenB.symbol}, ${tokenA.symbol}]`, async function () {
      const amounts = initializeAmounts(tokenB, data);
      const pools = await integral.getPoolIdentifiers(
        tokenB,
        tokenA,
        SwapSide.SELL,
        block,
      );
      console.log(
        `${tokenA.symbol} <> ${tokenB.symbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await integral.getPricesVolume(
        tokenB,
        tokenA,
        amounts,
        SwapSide.SELL,
        block,
        pools,
      );
      console.log(
        `${tokenA.symbol} <> ${tokenB.symbol} Pool Prices, SELL: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      if (integral.hasConstantPriceLargeAmounts) {
        checkConstantPoolPrices(poolPrices!, amounts, dexKey);
      } else {
        checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
      }

      // Check if onchain pricing equals to calculated ones
      await checkOnChainPricing(
        IntegralConfig[dexKey][network].relayerAddress,
        'quoteSell',
        block,
        poolPrices![0].prices,
        tokenB,
        tokenA,
        amounts,
      );
    });

    it(`getPoolIdentifiers and getPricesVolume BUY [${tokenA.symbol}, ${tokenB.symbol}]`, async function () {
      const amounts = initializeAmounts(tokenB, data);
      const pools = await integral.getPoolIdentifiers(
        tokenA,
        tokenB,
        SwapSide.BUY,
        block,
      );
      console.log(
        `${tokenA.symbol} <> ${tokenB.symbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await integral.getPricesVolume(
        tokenA,
        tokenB,
        amounts,
        SwapSide.BUY,
        block,
        pools,
      );
      console.log(
        `${tokenA.symbol} <> ${tokenB.symbol} Pool Prices, Buy: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      if (integral.hasConstantPriceLargeAmounts) {
        checkConstantPoolPrices(poolPrices!, amounts, dexKey);
      } else {
        checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
      }

      // Check if onchain pricing equals to calculated ones
      await checkOnChainPricing(
        IntegralConfig[dexKey][network].relayerAddress,
        'quoteBuy',
        block,
        poolPrices![0].prices,
        tokenA,
        tokenB,
        amounts,
      );
    });
  });
}

describe('Integral Top Pools', function () {
  const integral = new Integral(network, dexKey, dexHelper);
  const { tokenA } = testDatas[0];
  it(`getTopPoolsForToken [${tokenA.symbol}]`, async function () {
    const poolLiquidity = await integral.getTopPoolsForToken(
      tokenA.address,
      10,
    );
    console.log(`${tokenA.symbol} Top Pools:`, poolLiquidity);

    if (!integral.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    }
  });
});
