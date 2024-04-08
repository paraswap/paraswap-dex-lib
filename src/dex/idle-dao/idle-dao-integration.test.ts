import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { IdleDao, TOKEN_LIST_CACHE_KEY } from './idle-dao';
import {
  checkConstantPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';

const network = Network.MAINNET;
const TokenASymbol = 'DAI';
const TokenA = {
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  decimals: 18,
};

const TokenBSymbol = 'AA_clearpool_portofino_DAI';
const TokenB = {
  address: '0x43eD68703006add5F99ce36b5182392362369C1c',
  decimals: 18,
  symbol: 'AA_clearpool_portofino_DAI',
};

const amounts = [0n, BI_POWS[18], 2000000n];

const dexKey = 'IdleDao';

describe('IdleDao', function () {
  it('The "initializePricing" method sets cache properly', async () => {
    const dexHelper = new DummyDexHelper(network);
    const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const idleDao = new IdleDao(network, dexKey, dexHelper);

    await expect(
      dexHelper.cache.getAndCacheLocally(
        dexKey,
        network,
        TOKEN_LIST_CACHE_KEY,
        0,
      ),
    ).resolves.toBeNull();
    await idleDao.initializePricing(blockNumber);
    await expect(
      dexHelper.cache.getAndCacheLocally(
        dexKey,
        network,
        TOKEN_LIST_CACHE_KEY,
        0,
      ),
    ).resolves.not.toBeNull();
  });

  if (TokenA) {
    if (TokenB) {
      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        const dexHelper = new DummyDexHelper(network);
        const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        const idleDao = new IdleDao(network, dexKey, dexHelper);

        // Invoke the "initializePricing" method manually in tests. Invoked by the SDK automatically otherwise.
        await idleDao.initializePricing(blockNumber);

        const pools = await idleDao.getPoolIdentifiers(
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

        const poolPrices = await idleDao.getPricesVolume(
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
        checkConstantPoolPrices(poolPrices!, amounts, dexKey);
      });

      it('getPoolIdentifiers and getPricesVolume BUY', async function () {
        const dexHelper = new DummyDexHelper(network);
        const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
        const idleDao = new IdleDao(network, dexKey, dexHelper);

        // Invoke the "initializePricing" method manually in tests. Invoked by the SDK automatically otherwise.
        await idleDao.initializePricing(blocknumber);

        const pools = await idleDao.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blocknumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await idleDao.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blocknumber,
          pools,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();
        checkConstantPoolPrices(poolPrices!, amounts, dexKey);
      });
    } else expect(TokenB).not.toBeNull();

    /*
    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(network);
      const idleDao = new IdleDao(network, dexKey, dexHelper);

      const poolLiquidity = await idleDao.getTopPoolsForToken(
        TokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    });
    */
  } else expect(TokenA).not.toBe(undefined);
});
