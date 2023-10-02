import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { MantisSwap } from './mantis-swap';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface } from '@ethersproject/abi';
import PoolABI from '../../abi/mantis-swap/pool.json';

const network = Network.POLYGON;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];
const TokenALP = '0xe03aec0d08B3158350a9aB99f6Cea7bA9513B889';

const TokenBSymbol = 'DAI';
const TokenB = Tokens[network][TokenBSymbol];
const TokenBLP = '0x4b3BFcaa4F8BD4A276B81C110640dA634723e64B';

const amounts = [0n, 2000000n];

const dexKey = 'MantisSwap';

const poolInterface = new Interface(PoolABI);

describe('MantisSwap', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const mantisSwap = new MantisSwap(network, dexKey, dexHelper);

    await mantisSwap.initializePricing(blocknumber);

    const pools = await mantisSwap.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await mantisSwap.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (mantisSwap.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    // Reprice each pool using on chain calculation to check it's correct
    for (const poolPrice of poolPrices!) {
      const pricesFromContract = (
        await dexHelper.multiContract.methods
          .aggregate(
            amounts.slice(1).map(amount => ({
              target: poolPrice.data.pool,
              callData: poolInterface.encodeFunctionData('getSwapAmount', [
                TokenALP,
                TokenBLP,
                amount,
                false,
                0,
                0,
              ]),
            })),
          )
          .call({}, blocknumber)
      ).returnData.map((result: string) =>
        BigInt(
          poolInterface
            .decodeFunctionResult('getSwapAmount', result)
            .toAmount.toString(),
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
    const platypus = new MantisSwap(network, dexKey, dexHelper);

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
