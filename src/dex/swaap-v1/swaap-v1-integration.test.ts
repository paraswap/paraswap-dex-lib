import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { MAX_UINT, Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { SwaapV1 } from './swaap-v1';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BlockHeader } from 'web3-eth';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  srcTokenAddress: string,
  destTokenAddress: string,
  isSell: boolean,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      srcTokenAddress,
      isSell ? amount : MAX_UINT,
      destTokenAddress,
      isSell ? 0 : amount,
      MAX_UINT,
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
    return BigInt(parsed[0].amount);
  });
}

async function checkOnChainPricing(
  swaapV1: SwaapV1,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  srcTokenAddress: string,
  destTokenAddress: string,
  side: SwapSide,
) {
  const exchangeAddress = '0x7f5f7411c2c7eC60e2db946aBbe7DC354254870B';

  const readerIface = SwaapV1.poolInterface;

  const isSell = side == SwapSide.SELL ? true : false;
  const funcName = isSell ? 'getAmountOutGivenInMMM' : 'getAmountInGivenOutMMM';
  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    srcTokenAddress,
    destTokenAddress,
    isSell,
  );
  const readerResult = (
    await swaapV1.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  swaapV1: SwaapV1,
  network: Network,
  dexKey: string,
  block: BlockHeader,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await swaapV1.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    block.number,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await swaapV1.getPricesVolumeLogic(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    amounts,
    side,
    block.number,
    BigInt(block.timestamp),
    pools,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Prices: `,
    poolPrices,
  );

  expect(poolPrices).not.toBeNull();
  if (swaapV1.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    swaapV1,
    block.number,
    poolPrices![0].prices,
    amounts,
    networkTokens[srcTokenSymbol].address,
    networkTokens[destTokenSymbol].address,
    side,
  );
}

describe('SwaapV1', function () {
  const dexKey = 'SwaapV1';

  let block: BlockHeader | undefined = undefined;
  let swaapV1: SwaapV1;

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'USDC';
    const destTokenSymbol = 'WETH';

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

    const amountsForBuy = [0n, 1n * BI_POWS[tokens[destTokenSymbol].decimals]];

    beforeAll(async () => {
      swaapV1 = new SwaapV1(network, dexKey, dexHelper);

      block = await dexHelper.web3Provider.eth.getBlock('latest');

      if (swaapV1.initializePricing) {
        await swaapV1.initializePricing(block.number);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        swaapV1,
        network,
        dexKey,
        block!,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        swaapV1,
        network,
        dexKey,
        block!,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newSwaapV1 = new SwaapV1(network, dexKey, dexHelper);
      const poolLiquidity = await newSwaapV1.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newSwaapV1.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
