import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { BalancerV1 } from './balancer-v1';
import { BalancerV1EventPool } from './balancer-v1-pool';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { IDex } from '../idex';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  srcTokenBalance: bigint,
  destTokenBalance: bigint,
  srcTokenWeight: bigint,
  destTokenWeight: bigint,
  swapFee: bigint,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      srcTokenBalance,
      srcTokenWeight,
      destTokenBalance,
      destTokenWeight,
      amount,
      swapFee,
    ]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]);
  });
}

async function checkOnChainPricing(
  balancerV1: BalancerV1,
  exchangeAddress: string,
  funcName: string,
  srcTokenAddress: string,
  destTokenAddress: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const readerIface = BalancerV1EventPool.iface;

  const paramsCalldata = [
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData('getBalance', [srcTokenAddress]),
    },
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData('getBalance', [
        destTokenAddress,
      ]),
    },
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData('getDenormalizedWeight', [
        srcTokenAddress,
      ]),
    },
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData('getDenormalizedWeight', [
        destTokenAddress,
      ]),
    },
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData('getSwapFee'),
    },
  ];
  const paramsResult = (
    await balancerV1.dexHelper.multiContract.methods
      .aggregate(paramsCalldata)
      .call({}, blockNumber)
  ).returnData;
  const srcTokenBalance = BigInt(
    readerIface.decodeFunctionResult('getBalance', paramsResult[0])[0],
  );
  const destTokenBalance = BigInt(
    readerIface.decodeFunctionResult('getBalance', paramsResult[1])[0],
  );
  const srcTokenWeight = BigInt(
    readerIface.decodeFunctionResult(
      'getDenormalizedWeight',
      paramsResult[2],
    )[0],
  );
  const destTokenWeight = BigInt(
    readerIface.decodeFunctionResult(
      'getDenormalizedWeight',
      paramsResult[3],
    )[0],
  );
  const swapFee = BigInt(
    readerIface.decodeFunctionResult('getSwapFee', paramsResult[4])[0],
  );

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    srcTokenBalance,
    destTokenBalance,
    srcTokenWeight,
    destTokenWeight,
    swapFee,
  );
  const readerResult = (
    await balancerV1.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  balancerV1: BalancerV1,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  funcNameToCheck: string,
) {
  const networkTokens = Tokens[network];

  const pools = await balancerV1.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await balancerV1.getPricesVolume(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    amounts,
    side,
    blockNumber,
    pools,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Prices: `,
    poolPrices,
  );

  expect(poolPrices).not.toBeNull();
  if (balancerV1.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  for (const poolPrice of poolPrices!) {
    await checkOnChainPricing(
      balancerV1,
      poolPrice.data.poolId,
      funcNameToCheck,
      networkTokens[srcTokenSymbol].address,
      networkTokens[destTokenSymbol].address,
      blockNumber,
      poolPrice.prices,
      amounts,
    );
  }
}

describe('BalancerV1', function () {
  const dexKey = 'BalancerV1';
  let blockNumber: number;
  let balancerV1: BalancerV1;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'USDC';
    const destTokenSymbol = 'WETH';

    const amountsForSell = [
      0n,
      100n * BI_POWS[tokens[srcTokenSymbol].decimals],
      200n * BI_POWS[tokens[srcTokenSymbol].decimals],
      300n * BI_POWS[tokens[srcTokenSymbol].decimals],
      400n * BI_POWS[tokens[srcTokenSymbol].decimals],
      500n * BI_POWS[tokens[srcTokenSymbol].decimals],
      600n * BI_POWS[tokens[srcTokenSymbol].decimals],
      700n * BI_POWS[tokens[srcTokenSymbol].decimals],
      800n * BI_POWS[tokens[srcTokenSymbol].decimals],
      900n * BI_POWS[tokens[srcTokenSymbol].decimals],
      1000n * BI_POWS[tokens[srcTokenSymbol].decimals],
    ];

    const amountsForBuy = [
      0n,
      1n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      2n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      3n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      4n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      5n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      6n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      7n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      8n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      9n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
      10n * BI_POWS[tokens[destTokenSymbol].decimals - 1],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      balancerV1 = new BalancerV1(network, dexKey, dexHelper);
      if (balancerV1.initializePricing) {
        await balancerV1.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        balancerV1,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'calcOutGivenIn',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        balancerV1,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
        'calcInGivenOut',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newBalancerV1 = new BalancerV1(network, dexKey, dexHelper);
      if ((newBalancerV1 as IDex<any>).updatePoolState) {
        await (newBalancerV1 as IDex<any>).updatePoolState();
      }
      const poolLiquidity = await newBalancerV1.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newBalancerV1.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
