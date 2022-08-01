import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Angle } from './angle';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

const network = Network.MAINNET;
const TokenASymbol = 'DAI';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'agEUR';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [0n, BI_POWS[18], 2n * 10n ** 18n];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'Angle';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  poolManager: string,
  caller: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      amount,
      caller,
      poolManager,
      0,
    ]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  // TODO: Adapt this function for your needs
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  angle: Angle,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  poolManager: string,
) {
  const exchangeAddress = angle.config.agEUR.stableMaster;
  const readerIface = angle.interfaces.stablemaster;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    poolManager,
    dexHelper.config.data.augustusAddress,
  );

  const readerResult = (
    await dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  console.log('readerResult', readerResult);
  // const expectedPrices = [0n].concat(
  //   decodeReaderResult(readerResult, readerIface, funcName),
  // );

  // expect(prices).toEqual(expectedPrices);
}

describe('Angle', function () {
  let blockNumber: number;
  let angle: Angle;

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();

    angle = new Angle(network, dexKey, dexHelper);
    await angle.initializePricing(blockNumber);
  });

  it.only('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const pools = await angle.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await angle.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    console.log('poolPrices', poolPrices);

    expect(poolPrices).not.toBeNull();
    if (angle.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    await checkOnChainPricing(
      angle,
      'mint',
      blockNumber,
      poolPrices![0].prices,
      angle.tokens[TokenA.address.toLowerCase()].poolManager,
    );
  });

  // it('getPoolIdentifiers and getPricesVolume BUY', async function () {
  //   const pools = await angle.getPoolIdentifiers(
  //     TokenA,
  //     TokenB,
  //     SwapSide.BUY,
  //     blockNumber,
  //   );
  //   console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

  //   expect(pools.length).toBeGreaterThan(0);

  //   const poolPrices = await angle.getPricesVolume(
  //     TokenA,
  //     TokenB,
  //     amounts,
  //     SwapSide.BUY,
  //     blockNumber,
  //     pools,
  //   );
  //   console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

  //   expect(poolPrices).not.toBeNull();
  //   if (angle.hasConstantPriceLargeAmounts) {
  //     checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  //   } else {
  //     checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
  //   }

  //   // Check if onchain pricing equals to calculated ones
  //   await checkOnChainPricing(
  //     angle,
  //     '', // TODO: Put here the functionName to call
  //     blockNumber,
  //     poolPrices![0].prices,
  //   );
  // });

  // it('getTopPoolsForToken', async function () {
  //   const poolLiquidity = await angle.getTopPoolsForToken(TokenA.address, 10);
  //   console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

  //   if (!angle.hasConstantPriceLargeAmounts) {
  //     checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  //   }
  // });
});
