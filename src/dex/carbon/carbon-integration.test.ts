/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Carbon } from './carbon';
import CarbonControllerABI from '../../abi/carbon/CarbonController.abi.json';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Action, MatchActionBNStr, TradeActionBNStr } from './sdk/common/types';

// function getReaderCalldata(
//   exchangeAddress: string,
//   readerIface: Interface,
//   amounts: bigint[],
//   funcName: string,
//   strategyId: string,
//   token0: string,
//   token1: string,
//   tradeActions: TradeActionBNStr[][],
// ) {
//   return amounts.map(amount => ({
//     target: exchangeAddress,
//     callData: readerIface.encodeFunctionData(funcName, [
//       token0,
//       token1,
//       strategyId,
//       amount,
//       tradeActions,
//     ]),
//   }));
// }

// function decodeReaderResult(
//   results: Result,
//   readerIface: Interface,
//   funcName: string,
// ) {
//   // TODO: Adapt this function for your needs
//   return results.map(result => {
//     const parsed = readerIface.decodeFunctionResult(funcName, result);
//     return BigInt(parsed[0]._hex);
//   });
// }

// async function checkOnChainPricing(
//   carbon: Carbon,
//   funcName: string,
//   blockNumber: number,
//   prices: bigint[],
//   amounts: bigint[],
//   strategyId: string,
//   sourceToken: string,
//   targetToken: string,
//   tradeActions: TradeActionBNStr[][],
// ) {
//   const exchangeAddress = '0xC537e898CD774e2dCBa3B14Ea6f34C93d5eA45e1';

//   const readerIface = new Interface(CarbonControllerABI);

//   const readerCallData = getReaderCalldata(
//     exchangeAddress,
//     readerIface,
//     amounts.slice(1),
//     funcName,
//     strategyId,
//     sourceToken,
//     targetToken,
//     tradeActions,
//   );

//   const readerResult = (
//     await carbon.dexHelper.multiContract.methods
//       .aggregate(readerCallData)
//       .call({}, blockNumber)
//   ).returnData;

//   console.log(readerResult);

//   const expectedPrices = [0n].concat(
//     decodeReaderResult(readerResult, readerIface, funcName),
//   );

//   expect(prices).toEqual(expectedPrices);
// }

async function testPricingOnNetwork(
  carbon: Carbon,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await carbon.getPoolIdentifiers(
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

  const poolPrices = await carbon.getPricesVolume(
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
  if (carbon.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey, false);
  }

  // Cannot obtain on-chain pricing on Carbon

  // Check if onchain pricing equals to calculated ones
  // await checkOnChainPricing(
  //   carbon,
  //   funcNameToCheck,
  //   blockNumber,
  //   poolPrices![0].prices,
  //   amounts,
  //   strategyId,
  //   token0,
  //   token1,
  //   tradeActions
  // );
}

describe('Carbon', function () {
  const dexKey = 'Carbon';
  let blockNumber: number;
  let carbon: Carbon;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'USDC';
    const destTokenSymbol = 'ETH';

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

    const amountsForBuy = [
      0n,
      1n * BI_POWS[tokens[destTokenSymbol].decimals],
      2n * BI_POWS[tokens[destTokenSymbol].decimals],
      3n * BI_POWS[tokens[destTokenSymbol].decimals],
      4n * BI_POWS[tokens[destTokenSymbol].decimals],
      5n * BI_POWS[tokens[destTokenSymbol].decimals],
      6n * BI_POWS[tokens[destTokenSymbol].decimals],
      7n * BI_POWS[tokens[destTokenSymbol].decimals],
      8n * BI_POWS[tokens[destTokenSymbol].decimals],
      9n * BI_POWS[tokens[destTokenSymbol].decimals],
      10n * BI_POWS[tokens[destTokenSymbol].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      carbon = new Carbon(network, dexKey, dexHelper);
      if (carbon.initializePricing) {
        await carbon.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        carbon,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        carbon,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newCarbon = new Carbon(network, dexKey, dexHelper);
      if (newCarbon.updatePoolState) {
        await newCarbon.updatePoolState();
      }
      const poolLiquidity = await newCarbon.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newCarbon.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
