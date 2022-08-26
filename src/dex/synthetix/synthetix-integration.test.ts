import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Synthetix } from './synthetix';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { dexPriceAggregatorUniswapV3 } from './contract-math/DexPriceAggregatorUniswapV3';
import { SynthetixState } from './synthetix-state';
import { MultiWrapper } from '../../lib/multi-wrapper';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  sourceCurrencyKey: string,
  destCurrencyKey: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      amount,
      sourceCurrencyKey,
      destCurrencyKey,
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
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  synthetix: Synthetix,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  srcTokenSymbol: string,
  destTokenSymbol: string,
) {
  const exchangeAddress = synthetix.onchainConfigValues.exchangerAddress;
  const readerIface = synthetix.combinedIface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    synthetix.onchainConfigValues!.addressToKey[
      Tokens[synthetix.network][srcTokenSymbol].address.toLowerCase()
    ],
    synthetix.onchainConfigValues!.addressToKey[
      Tokens[synthetix.network][destTokenSymbol].address.toLowerCase()
    ],
  );

  const readerResult = (
    await synthetix.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;
  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  synthetix: Synthetix,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  amounts: bigint[],
  funcNameToCheck: string,
) {
  const networkTokens = Tokens[network];

  const pools = await synthetix.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    SwapSide.SELL,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await synthetix.getPricesVolume(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    amounts,
    SwapSide.SELL,
    blockNumber,
    pools,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Prices: `,
    poolPrices,
  );

  expect(poolPrices).not.toBeNull();
  checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    synthetix,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    srcTokenSymbol,
    destTokenSymbol,
  );
}

describe('Synthetix', function () {
  const dexKey = 'Synthetix';

  let blockNumber: number;
  let synthetix: Synthetix;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const srcTokenSymbol = 'sBTC';
    const destTokenSymbol = 'sETH';

    const amounts = [
      0n,
      1n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      2n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      3n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      4n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      5n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      6n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      7n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      8n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      9n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
    ];

    const dexHelper = new DummyDexHelper(network);

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      synthetix = new Synthetix(network, dexKey, dexHelper);
      await synthetix.initializePricing(blockNumber);
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async () => {
      await testPricingOnNetwork(
        synthetix,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        amounts,
        'getAmountsForAtomicExchange',
      );
    });
    it('getTopPoolsForToken', async function () {
      const newSynthetix = new Synthetix(network, dexKey, dexHelper);
      await newSynthetix.updatePoolState();
      const poolLiquidity = await newSynthetix.getTopPoolsForToken(
        Tokens[network][srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newSynthetix.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });

    it('Compute UniswapV3 address from token0, token1, fee in _computeAddress', async function () {
      const uniswapV3Factory = '0x1f98431c8ad98523631ae4a59f267346ea31f984';
      const computed = dexPriceAggregatorUniswapV3._computeAddress(
        uniswapV3Factory,
        {
          token0: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          token1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          fee: 500n,
        },
      );
      expect(computed).toEqual('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640');
    });

    it('Check state invalidating mechanism for onchainConfigValues', async () => {
      const updateFrequency = 500;
      const synthState = new SynthetixState(
        dexKey,
        dexHelper,
        new MultiWrapper(dexHelper.multiContract, dexHelper.getLogger()),
        synthetix.combinedIface,
        synthetix.config,
        updateFrequency,
      );
      await synthState.updateOnchainConfigValues();
      // @ts-expect-error
      const firstUpdate = synthState._onchainConfigValues.updatedAtInMs;
      const secondUpdateTime = await new Promise<number>(resolve => {
        // wait before triggering the update
        setTimeout(() => {
          synthState.onchainConfigValues;
          setTimeout(() => {
            // @ts-expect-error
            const secondUpdate = synthState._onchainConfigValues.updatedAtInMs;
            resolve(secondUpdate);
            // I expect that in 1 sec the state will be updated after the request
          }, 1000);
        }, updateFrequency);
      });
      expect(firstUpdate + updateFrequency).toBeLessThan(secondUpdateTime);
    });
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;
    const srcTokenSymbol = 'sBTC';
    const destTokenSymbol = 'sETH';

    const amounts = [
      0n,
      1n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      2n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      3n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      4n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      5n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      6n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      7n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      8n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
      9n * BI_POWS[Tokens[network][srcTokenSymbol].decimals],
    ];

    const dexHelper = new DummyDexHelper(network);

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      synthetix = new Synthetix(network, dexKey, dexHelper);
      await synthetix.initializePricing(blockNumber);
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async () => {
      await testPricingOnNetwork(
        synthetix,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        amounts,
        'getAmountsForExchange',
      );
    });
    it('getTopPoolsForToken', async function () {
      const newSynthetix = new Synthetix(network, dexKey, dexHelper);
      await newSynthetix.updatePoolState();
      const poolLiquidity = await newSynthetix.getTopPoolsForToken(
        Tokens[network][srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newSynthetix.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
