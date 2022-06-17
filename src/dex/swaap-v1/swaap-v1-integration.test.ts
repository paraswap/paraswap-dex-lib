import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper, IDexHelper } from '../../dex-helper/index';
import { MAX_UINT, Network, SwapSide } from '../../constants';
import { SwaapV1 } from './swaap-v1';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface } from '@ethersproject/abi';
import PoolABI from '../../abi/swaap-v1/pool.json';

const network = Network.POLYGON;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WETH';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [0n, 1000n, 2000n];

const dexKey = 'SwaapV1';

const poolInterface = new Interface(PoolABI);

const specificBlockNumber = 29831233;
const specificBlockTimestamp = BigInt(1655821356);

describe('SwaapV1', function () {
  for (const side of [SwapSide.BUY, SwapSide.SELL]) {
    it(`getPoolIdentifiers and getPricesVolume ${side}: block=latest`, async function () {
      const dexHelper = new DummyDexHelper(network);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      await integrationTest(dexHelper, blocknumber, null, side);
    });

    it(`getPoolIdentifiers and getPricesVolume ${side}: block=${specificBlockNumber}`, async function () {
      const dexHelper = new DummyDexHelper(network);
      await integrationTest(
        dexHelper,
        specificBlockNumber,
        specificBlockTimestamp,
        side,
      );
    });
  }

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const swaapv1 = new SwaapV1(network, dexKey, dexHelper);

    const poolLiquidity = await swaapv1.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!swaapv1.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});

async function integrationTest(
  dexHelper: IDexHelper,
  blocknumber: number,
  blocktimestamp: bigint | null,
  side: SwapSide,
) {
  const isSell = side == SwapSide.SELL;

  const swaapv1 = new SwaapV1(network, dexKey, dexHelper);

  await swaapv1.initializePricing(blocknumber);

  const pools = await swaapv1.getPoolIdentifiers(
    isSell ? TokenA : TokenB,
    isSell ? TokenB : TokenA,
    side,
    blocknumber,
  );
  console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await swaapv1.getPricesVolumeLogic(
    isSell ? TokenA : TokenB,
    isSell ? TokenB : TokenA,
    amounts,
    side,
    blocknumber,
    blocktimestamp,
    pools,
  );
  if (!isSell && poolPrices) {
    // on buy, price for a 0 amount will be 1 (decimals issue)
    for (const poolPrice of poolPrices!) {
      if ((poolPrice.prices[0] = 1n)) {
        poolPrice.prices[0] = 0n;
      }
    }
  }
  console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

  expect(poolPrices).not.toBeNull();
  if (swaapv1.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  if (blocktimestamp != null) {
    // Reprice each pool using on chain calculation to check it's correct
    const functionName = isSell
      ? 'getAmountOutGivenInMMM'
      : 'getAmountInGivenOutMMM';
    for (const poolPrice of poolPrices!) {
      const pricesFromContract = (
        await dexHelper.multiContract.methods
          .aggregate(
            amounts.slice(1).map(amount => ({
              target: poolPrice.data.pool,
              callData: poolInterface.encodeFunctionData(functionName, [
                isSell ? TokenA.address : TokenB.address,
                isSell ? amount : MAX_UINT,
                isSell ? TokenB.address : TokenA.address,
                isSell ? 0 : amount,
                MAX_UINT,
              ]),
            })),
          )
          .call({}, blocknumber)
      ).returnData.map((result: string) =>
        BigInt(
          poolInterface
            .decodeFunctionResult(functionName, result)
            .swapResult[0].toString(),
        ),
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} From Contract ${poolPrice.data.pool} Prices:`,
        pricesFromContract,
      );
      console.log(pricesFromContract, poolPrice.prices);
      expect(pricesFromContract).toEqual(poolPrice.prices.slice(1));
    }
  }
}
