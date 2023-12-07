/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { BigNumber } from 'ethers';
import { Tokens } from '../../../tests/constants-e2e';
import { checkPoolsLiquidity } from '../../../tests/utils';
import CLAYMAIN_ABI from '../../abi/claystack/clayMain.json';
import { BI_POWS } from '../../bigint-constants';
import { Network, SwapSide } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { Claystack } from './claystack';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, []),
  }));
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
  claystack: Claystack,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const exchangeAddress = '0x331312DAbaf3d69138c047AaC278c9f9e0E8FFf8';

  // Normally you can get it from claystack.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = new Interface(CLAYMAIN_ABI);

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await claystack.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  readerResult.forEach((result: string, index: number) => {
    expect(BigNumber.from(result).toString()).not.toEqual(
      prices[index + 1].toString(),
    );
  });
}

async function testPricingOnNetwork(
  claystack: Claystack,
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

  const pools = await claystack.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThanOrEqual(0);

  const poolPrices = await claystack.getPricesVolume(
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

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    claystack,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
  );
}

describe('Claystack', function () {
  const dexKey = 'Claystack';
  let blockNumber: number;
  let claystack: Claystack;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'ETH';
    const destTokenSymbol = 'csETH';

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
      claystack = new Claystack(network, dexKey, dexHelper);
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        claystack,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
        'getExchangeRate',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newClaystack = new Claystack(network, dexKey, dexHelper);
      const poolLiquidity = await newClaystack.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );

      if (!newClaystack.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
