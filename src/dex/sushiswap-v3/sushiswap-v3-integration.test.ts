import { UniswapV3 } from '../uniswap-v3/uniswap-v3';
import { Network, SwapSide } from '../../constants';
import { DummyDexHelper, IDexHelper } from '../../dex-helper';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Interface, Result } from '@ethersproject/abi';
import UniswapV3QuoterV2ABI from '../../abi/uniswap-v3/UniswapV3QuoterV2.abi.json';
import { Address } from '@paraswap/core';

const quoterIface = new Interface(UniswapV3QuoterV2ABI);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      [tokenIn, tokenOut, amount.toString(), fee.toString(), 0],
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
  dexHelper: IDexHelper,
  uniswapV3: UniswapV3,
  funcName: string,
  blockNumber: number,
  exchangeAddress: string,
  prices: bigint[],
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
  _amounts: bigint[],
) {
  // Quoter address
  // const exchangeAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
  const readerIface = quoterIface;

  // const sum = prices.reduce((acc, curr) => (acc += curr), 0n);
  //
  // if (sum === 0n) {
  //   console.log(
  //     `Prices were not calculated for tokenIn=${tokenIn}, tokenOut=${tokenOut}, fee=${fee.toString()}. Most likely price impact is too big for requested amount`,
  //   );
  //   return false;
  // }

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    _amounts.slice(1),
    funcName,
    tokenIn,
    tokenOut,
    fee,
  );

  let readerResult;
  try {
    readerResult = (
      await dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;
  } catch (e) {
    console.log(
      `Can not fetch on-chain pricing for fee ${fee}. It happens for low liquidity pools`,
      e,
    );
    return false;
  }

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  console.log('EXPECTED PRICES: ', expectedPrices);

  let firstZeroIndex = prices.slice(1).indexOf(0n);

  // we skipped first, so add +1 on result
  firstZeroIndex = firstZeroIndex === -1 ? prices.length : firstZeroIndex;

  // Compare only the ones for which we were able to calculate prices
  expect(prices.slice(0, firstZeroIndex)).toEqual(
    expectedPrices.slice(0, firstZeroIndex),
  );
  return true;
}

describe('SushiSwapV3', () => {
  const dexKey = 'SushiSwapV3';

  describe('Mainnet', () => {
    let blockNumber: number;
    let uniswapV3: UniswapV3;
    let uniswapV3Mainnet: UniswapV3;

    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);
    const TokenASymbol = 'USDC';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDT';
    const TokenB = Tokens[network][TokenBSymbol];

    beforeEach(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      uniswapV3 = new UniswapV3(network, dexKey, dexHelper);
      uniswapV3Mainnet = new UniswapV3(Network.MAINNET, dexKey, dexHelper);
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      const amounts = [0n, BI_POWS[6], 2000000n];

      const pools = await uniswapV3.getPoolIdentifiers(
        TokenA,
        TokenB,
        SwapSide.SELL,
        blockNumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await uniswapV3.getPricesVolume(
        TokenA,
        TokenB,
        amounts,
        SwapSide.SELL,
        blockNumber,
        pools,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      let falseChecksCounter = 0;
      await Promise.all(
        poolPrices!.map(async price => {
          const fee = uniswapV3.eventPools[price.poolIdentifier!]!.feeCode;
          const res = await checkOnChainPricing(
            dexHelper,
            uniswapV3,
            'quoteExactInputSingle',
            blockNumber,
            '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
            price.prices,
            TokenA.address,
            TokenB.address,
            fee,
            amounts,
          );
          if (res === false) falseChecksCounter++;
        }),
      );

      expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      const amounts = [0n, BI_POWS[6], 2000000n];

      const pools = await uniswapV3.getPoolIdentifiers(
        TokenA,
        TokenB,
        SwapSide.BUY,
        blockNumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await uniswapV3.getPricesVolume(
        TokenA,
        TokenB,
        amounts,
        SwapSide.BUY,
        blockNumber,
        pools,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      let falseChecksCounter = 0;
      await Promise.all(
        poolPrices!.map(async price => {
          const fee = uniswapV3.eventPools[price.poolIdentifier!]!.feeCode;
          const res = await checkOnChainPricing(
            dexHelper,
            uniswapV3,
            'quoteExactOutputSingle',
            blockNumber,
            '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
            price.prices,
            TokenA.address,
            TokenB.address,
            fee,
            amounts,
          );
          if (res === false) falseChecksCounter++;
        }),
      );

      expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
    });

    it('getTopPoolsForToken', async function () {
      const poolLiquidity = await uniswapV3.getTopPoolsForToken(
        TokenB.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, TokenB.address, dexKey);
    });
  });
});
