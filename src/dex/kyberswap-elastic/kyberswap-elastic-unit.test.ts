/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';

import { KyberswapElastic } from './kyberswap-elastic';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { Tokens } from '../../../tests/constants-e2e';
import { KyberswapElasticEventPool } from './kyberswap-elastic-pool';

describe('KyberswapElastic', function () {
  const dexKey = 'KyberswapElastic';
  let blockNumber: number;
  let kyberswapElastic: KyberswapElastic;

  describe('Mainnet', () => {
    const network = Network.POLYGON;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'WETH';
    const destTokenSymbol = 'USDT';

    let logger: Logger = dexHelper.getLogger(dexKey + ' Test - ' + network);

    beforeAll(async () => {});

    it('computePoolAddress', async function () {
      const fee = 2000n;
      const poollAddress: Address =
        '0xc270E8bFddD1baeCB63f1F168cF16a5aF43F25F0';

      const pool = new KyberswapElasticEventPool(
        dexKey,
        network,
        dexHelper,
        logger,
        undefined,
        fee,
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
      );

      const poolAddress = pool._computePoolAddress(
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
        fee,
      );
      expect(poolAddress).toEqual(poollAddress);
    });

    it('generateState', async function () {
      const fee = 2000n;

      const pool = new KyberswapElasticEventPool(
        dexKey,
        network,
        dexHelper,
        logger,
        undefined,
        fee,
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
      );

      const poolAddress = pool._computePoolAddress(
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
        fee,
      );

      pool.poolAddress = poolAddress;

      pool.generateState(45055522);
    });
  });
});
