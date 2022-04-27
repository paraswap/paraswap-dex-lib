import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { Platypus } from './platypus';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface } from '@ethersproject/abi';
import PoolABI from '../../abi/platypus/pool.json';

const network = Network.AVALANCHE;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'DAIE';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [BigInt('0'), BigInt('100000000000'), BigInt('200000000000')];

const dexKey = 'Platypus';

const poolInterface = new Interface(PoolABI);

describe('Platypus', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const platypus = new Platypus(network, dexKey, dexHelper);

    await platypus.initializePricing(blocknumber);

    const pools = await platypus.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await platypus.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (platypus.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    //Reprice each pool using on chain calculation to check it's correct
    for (const poolPrice of poolPrices!) {
      const pricesFromContract = (
        await dexHelper.multiContract.methods
          .aggregate(
            amounts.slice(1).map(amount => ({
              target: poolPrice.data.pool,
              callData: poolInterface.encodeFunctionData('quotePotentialSwap', [
                TokenA.address,
                TokenB.address,
                amount,
              ]),
            })),
          )
          .call({}, blocknumber)
      ).returnData.map((result: string) =>
        BigInt(
          poolInterface
            .decodeFunctionResult('quotePotentialSwap', result)
            .potentialOutcome.toString(),
        ),
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} From Contract ${poolPrice.data.pool} Prices:`,
        pricesFromContract,
      );
      expect(pricesFromContract).toEqual(poolPrice.prices.slice(1));
    }
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const platypus = new Platypus(network, dexKey, dexHelper);

    const poolLiquidity = await platypus.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!platypus.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
