/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { VenusConfig } from './config';
import TokenConverter from '../../abi/venus/token-converter.json';
import { Venus } from './venus';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

/*
  README
  ======

  This test script adds tests for Venus general integration
  with the DEX interface.

  You can run this individual test script by running:
  `npx jest src/dex/venus/venus-integration.test.ts`
*/

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenAddressIn: string,
  tokenAddressOut: string,
) {
  const callData = amounts.map(amount => {
    return {
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData(funcName, [
        amount,
        tokenAddressIn,
        tokenAddressOut,
      ]),
    };
  });
  return callData;
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[1]._hex);
  });
}

async function checkOnChainPricing(
  venus: Venus,
  tokenConverterAddress: string,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  tokenAddressIn: string,
  tokenAddressOut: string,
) {
  const exchangeAddress = tokenConverterAddress;

  const readerIface = new Interface(TokenConverter);

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    tokenAddressIn,
    tokenAddressOut,
  );

  const readerResult = (
    await venus.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;
  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );
  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  venus: Venus,
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

  const pools = await venus.getPoolIdentifiers(
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

  const poolPrices = await venus.getPricesVolume(
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
  if (venus.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    venus,
    VenusConfig[dexKey][network].converterAddress,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    networkTokens[srcTokenSymbol].address,
    networkTokens[destTokenSymbol].address,
  );
}

describe('Venus', function () {
  let blockNumber: number;
  let venus: Venus;

  describe('BSC', () => {
    const network = Network.BSC;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const dexKeys = [
      ['UsdtPrimeConverter', 'USDT'],
      ['BtcbPrimeConverter', 'bBTC'],
      ['UsdcPrimeConverter', 'USDC'],
      ['EthPrimeConverter', 'ETH'],
      ['XvsVaultConverter', 'XVS'],
    ];

    for (const [dexKey, srcTokenSymbol] of dexKeys) {
      describe(dexKey, () => {
        const destTokenSymbol = 'WBNB';
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
          venus = new Venus(network, dexKey, dexHelper);

          if (venus.initializePricing) {
            await venus.initializePricing(blockNumber);
          }
        });

        afterAll(async () => {
          await venus.releaseResources();
        });

        // Only Supply is supported
        it(`getPoolIdentifiers and getPricesVolume SELL ${srcTokenSymbol}`, async function () {
          await testPricingOnNetwork(
            venus,
            network,
            dexKey,
            blockNumber,
            srcTokenSymbol,
            destTokenSymbol,
            SwapSide.SELL,
            amountsForSell,
            'getUpdatedAmountOut',
          );
        });

        it('getTopPoolsForToken', async function () {
          // We have to check without calling initializePricing, because
          // pool-tracker is not calling that function
          const newVenus = new Venus(network, dexKey, dexHelper);

          if (newVenus.updatePoolState) {
            await newVenus.updatePoolState();
          }

          const poolLiquidity = await newVenus.getTopPoolsForToken(
            tokens[srcTokenSymbol].address,
            10,
          );

          expect(poolLiquidity.length).toEqual(10);
          for (const [idx, pool] of Object.entries(poolLiquidity)) {
            if (Number(idx) < 9) {
              expect(pool.liquidityUSD).toBeGreaterThan(
                poolLiquidity[Number(idx) + 1].liquidityUSD,
              );
            }
          }

          console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

          if (!newVenus.hasConstantPriceLargeAmounts) {
            checkPoolsLiquidity(
              poolLiquidity,
              Tokens[network][srcTokenSymbol].address,
              dexKey,
            );
          }
        });
      });
    }
  });
});
