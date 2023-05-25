/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { UnshEth } from './unsh-eth';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  srcAddress: string,
  destAddress: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      amount,
      srcAddress,
      destAddress,
    ]),
  }));
}

function getFeeReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  srcAddress: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [amount, srcAddress]),
  }));
}

function getPriceReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  funcName: string,
  srcAddress: string,
) {
  return [
    {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData(funcName, [srcAddress]),
    },
  ];
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  unshEth: UnshEth,
  funcName: string,
  feeFuncName: string,
  priceFuncName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  srcAddress: string,
  destAddress: string,
) {
  const exchangeAddress = '0x35636B85B68C1b4A216110fB3A5FB447a99DB14A';
  const lsdVaultAddress = '0x51A80238B5738725128d3a3e06Ab41c1d4C05C74';
  const unshETHAddress = '0x0Ae38f7E10A43B5b2fB064B42a2f4514cbA909ef';

  if (destAddress.toLowerCase() === unshETHAddress.toLowerCase()) {
    const feeReaderIface = UnshEth.vdAmmInterface;

    const feeReaderCallData = getFeeReaderCalldata(
      exchangeAddress,
      feeReaderIface,
      amounts.slice(1),
      feeFuncName,
      srcAddress,
    );
    const feeReaderResult = (
      await unshEth.dexHelper.multiContract.methods
        .aggregate(feeReaderCallData)
        .call({}, blockNumber)
    ).returnData;

    const depositFees = decodeReaderResult(
      feeReaderResult,
      feeReaderIface,
      feeFuncName,
    );

    const priceReaderIface = UnshEth.lsdVaultInterface;

    const priceReaderCallData = getPriceReaderCalldata(
      lsdVaultAddress,
      priceReaderIface,
      priceFuncName,
      srcAddress,
    );
    const priceReaderResult = (
      await unshEth.dexHelper.multiContract.methods
        .aggregate(priceReaderCallData)
        .call({}, blockNumber)
    ).returnData;

    const tokenPrices = decodeReaderResult(
      priceReaderResult,
      priceReaderIface,
      priceFuncName,
    );

    const expectedPrices = [0n].concat(
      amounts
        .slice(1)
        .map(
          (amount, i) =>
            (tokenPrices[0] * (amount - depositFees[i])) /
            BigInt('1000000000000000000'),
        ),
    );

    expect(prices).toEqual(expectedPrices);
  } else {
    const readerIface = UnshEth.vdAmmInterface;

    const readerCallData = getReaderCalldata(
      exchangeAddress,
      readerIface,
      amounts.slice(1),
      funcName,
      srcAddress,
      destAddress,
    );
    const readerResult = (
      await unshEth.dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;

    const expectedPrices = [0n].concat(
      decodeReaderResult(readerResult, readerIface, funcName),
    );

    expect(prices).toEqual(expectedPrices);
  }
}

async function testPricingOnNetwork(
  unshEth: UnshEth,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  funcNameToCheck: string,
  feeFuncName: string,
  priceFuncName: string,
) {
  const networkTokens = Tokens[network];

  const pools = await unshEth.getPoolIdentifiers(
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

  const poolPrices = await unshEth.getPricesVolume(
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
  if (unshEth.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    unshEth,
    funcNameToCheck,
    feeFuncName,
    priceFuncName,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    networkTokens[srcTokenSymbol].address,
    networkTokens[destTokenSymbol].address,
  );
}

describe('UnshEth', function () {
  const dexKey = 'UnshEth';
  let blockNumber: number;
  let unshEth: UnshEth;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'wstETH';
    const destTokenSymbol1 = 'cbETH';
    const destTokenSymbol2 = 'unshETH';

    const amountsForSell = [
      0n,
      1n * BI_POWS[tokens[srcTokenSymbol].decimals],
      2n * BI_POWS[tokens[srcTokenSymbol].decimals],
      3n * BI_POWS[tokens[srcTokenSymbol].decimals],
      4n * BI_POWS[tokens[srcTokenSymbol].decimals],
      5n * BI_POWS[tokens[srcTokenSymbol].decimals],
      6n * BI_POWS[tokens[srcTokenSymbol].decimals],
      7n * BI_POWS[tokens[srcTokenSymbol].decimals],
      8n * BI_POWS[tokens[srcTokenSymbol].decimals],
      9n * BI_POWS[tokens[srcTokenSymbol].decimals],
      10n * BI_POWS[tokens[srcTokenSymbol].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      unshEth = new UnshEth(network, dexKey, dexHelper);
      // if (unshEth.initializePricing) {
      //   await unshEth.initializePricing(blockNumber);
      // }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        unshEth,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol1,
        SwapSide.SELL,
        amountsForSell,
        'swapLsdToLsdCalcs',
        'getDepositFee',
        'getPrice',
      );
      await testPricingOnNetwork(
        unshEth,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol2,
        SwapSide.SELL,
        amountsForSell,
        'swapLsdToLsdCalcs',
        'getDepositFee',
        'getPrice',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newUnshEth = new UnshEth(network, dexKey, dexHelper);
      // if (newUnshEth.updatePoolState) {
      //   await newUnshEth.updatePoolState();
      // }
      const poolLiquidity = await newUnshEth.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newUnshEth.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
