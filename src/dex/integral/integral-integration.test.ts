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

const network = Network.MAINNET;
const pairs = [
  ['USDC', 'WETH'],
];
const testData = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'Integral';

function initializeTokens() {
  let tokensInPairs: Token[][] = [];
  for (const [TokenASymbol, TokenBSymbol] of pairs) {
    const TokenA = Tokens[network][TokenASymbol];
    const TokenB = Tokens[network][TokenBSymbol];
    TokenA.symbol = TokenASymbol;
    TokenB.symbol = TokenBSymbol;
    tokensInPairs.push([TokenA, TokenB]);
  }
  return tokensInPairs;
}

function initializeAmounts(token: Token, units: number[]) {
  return units.map(unit => BigInt(unit) * BI_POWS[token.decimals - 1]);
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
  const relayerInterface = new Interface(IntegralRelayerABI)
  const callData = expectedAmounts.slice(1).map(amount => ({
    target: relayerAddress,
    callData: relayerInterface.encodeFunctionData(funcName, [TokenA.address, TokenB.address, amount]),
  }));
  const results = (
    await dexHelper.multiContract.methods
      .aggregate(callData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(results.map((result: string) => BigInt(result)))
  expect(prices).toEqual(expectedPrices);
}

describe('Integral', function () {
  let blockNumber: number;
  let integral: Integral;
  const tokensInPairs = initializeTokens();

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();

    integral = new Integral(network, dexKey, dexHelper);
    await integral.initializePricing(blockNumber);
  });

  for (const [TokenA, TokenB] of tokensInPairs) {
    it(`getPoolIdentifiers and getPricesVolume SELL [${TokenA.symbol}, ${TokenB.symbol}]`, async function () {
      const amounts = initializeAmounts(TokenB, testData);
      const pools = await integral.getPoolIdentifiers(
        TokenB,
        TokenA,
        SwapSide.SELL,
        blockNumber,
      );
      console.log(
        `${TokenA.symbol} <> ${TokenB.symbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await integral.getPricesVolume(
        TokenB,
        TokenA,
        amounts,
        SwapSide.SELL,
        blockNumber,
        pools,
      );
      console.log(
        `${TokenA.symbol} <> ${TokenB.symbol} Pool Prices, SELL: `,
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
        blockNumber,
        poolPrices![0].prices,
        TokenB,
        TokenA,
        amounts,
      );
    });

    it(`getPoolIdentifiers and getPricesVolume BUY [${TokenA.symbol}, ${TokenB.symbol}]`, async function () {
      const amounts = initializeAmounts(TokenB, testData);
      const pools = await integral.getPoolIdentifiers(
        TokenA,
        TokenB,
        SwapSide.BUY,
        blockNumber,
      );
      console.log(
        `${TokenA.symbol} <> ${TokenB.symbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await integral.getPricesVolume(
        TokenA,
        TokenB,
        amounts,
        SwapSide.BUY,
        blockNumber,
        pools,
      );
      console.log(
        `${TokenA.symbol} <> ${TokenB.symbol} Pool Prices, Buy: `,
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
        blockNumber,
        poolPrices![0].prices,
        TokenA,
        TokenB,
        amounts,
      );
    });
  }
});

describe('Integral Top Pools', function () {
  let integral: Integral;
  const tokensInPairs = initializeTokens();

  integral = new Integral(network, dexKey, dexHelper);
  for (const [TokenA, TokenB] of tokensInPairs) {
    it(`getTopPoolsForToken [${TokenA.symbol}]`, async function () {
      const poolLiquidity = await integral.getTopPoolsForToken(
        TokenA.address,
        10,
      );
      console.log(`${TokenA.symbol} Top Pools:`, poolLiquidity);

      if (!integral.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
      }
    });
  }
});
