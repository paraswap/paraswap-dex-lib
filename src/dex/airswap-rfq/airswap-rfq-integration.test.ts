import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { AirswapRFQ } from './airswap-rfq';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  sleep,
} from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { parseInt } from 'lodash';
import { startTestServer } from './example-rfq-api.test';
import { ethers } from 'ethers';
import { RFQConfig } from './types';

if (!process.env.TEST_PORT) {
  throw new Error(`Missing TEST_PORT variable`);
}

const PORT_TEST_SERVER = parseInt(process.env.TEST_PORT!, 10);

const WETH = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
};

const DAI = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18,
};

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'AirswapRFQ';

const PK_KEY = process.env.TEST_PK_KEY;

if (!PK_KEY) {
  throw new Error('Mising TEST_PK_KEY');
}

const account = new ethers.Wallet(PK_KEY!);
const stopServer = startTestServer(account);

const config: RFQConfig = {
  maker: process.env.TEST_ADDRESS!,
  tokensConfig: {
    reqParams: {
      url: `http://localhost:${PORT_TEST_SERVER}`,
      method: 'GET',
    },
    // secret: {
    // domain: 'paraswap-test',
    // accessKey: 'access',
    // secretKey: 'secret',
    // },
    intervalMs: 1000 * 60 * 60 * 10, // every 10 minutes
    dataTTLS: 1000 * 60 * 60 * 11, // ttl 11 minutes
  },
  pairsConfig: {
    reqParams: {
      url: `http://localhost:${PORT_TEST_SERVER}`,
      method: 'GET',
    },
    // secret: {
    // domain: 'paraswap-test',
    // accessKey: 'access',
    // secretKey: 'secret',
    // },
    intervalMs: 1000 * 60 * 60 * 10, // every 10 minutes
    dataTTLS: 1000 * 60 * 60 * 11, // ttl 11 minutes
  },
  rateConfig: {
    reqParams: {
      url: `http://localhost:${PORT_TEST_SERVER}`,
      method: 'GET',
    },
    // secret: {
    // domain: 'paraswap-test',
    // accessKey: 'access',
    // secretKey: 'secret',
    // },
    intervalMs: 1000 * 60 * 60 * 1, // every 1 minute
    dataTTLS: 1000 * 60 * 60 * 1, // ttl 1 minute
  },
  firmRateConfig: {
    url: `http://localhost:${PORT_TEST_SERVER}`,
    method: 'GET',
    secret: {
      domain: 'paraswap-test',
      accessKey: 'access',
      secretKey: 'secret',
    },
  },
  blacklistConfig: {
    reqParams: {
      url: `http://localhost:${PORT_TEST_SERVER}`,
      method: 'GET',
    },
    // secret: {
    // domain: 'paraswap-test',
    // accessKey: 'access',
    // secretKey: 'secret',
    // },
    intervalMs: 1000 * 60 * 60 * 10, // every 10 minute
    dataTTLS: 1000 * 60 * 60 * 10, // ttl 10 minute
  },
};

describe('AirswapRFQ', function () {
  const network = Network.GOERLI;
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const airswapRfq = new AirswapRFQ(network, dexKey, dexHelper, config);

    airswapRfq.initializePricing(blocknumber);
    await sleep(5000);

    const pools = await airswapRfq.getPoolIdentifiers(
      WETH,
      DAI,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('WETH <> DAI Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await airswapRfq.getPricesVolume(
      WETH,
      DAI,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('WETH <> DAI Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const airswapRfq = new AirswapRFQ(network, dexKey, dexHelper, config);

    airswapRfq.initializePricing(blocknumber);
    await sleep(5000);

    const pools = await airswapRfq.getPoolIdentifiers(
      WETH,
      DAI,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('WETH <> DAI Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await airswapRfq.getPricesVolume(
      WETH,
      DAI,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log('WETH <> DAI Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const airswapRfq = new AirswapRFQ(network, dexKey, dexHelper, config);

    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    airswapRfq.initializePricing(blocknumber);
    await sleep(5000);

    const poolLiquidity = await airswapRfq.getTopPoolsForToken(
      WETH.address,
      10,
    );
    console.log('WETH Top Pools:', poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, WETH.address, dexKey);
  });

  it('blacklist', async () => {
    const dexHelper = new DummyDexHelper(network);
    const airswapRfq = new AirswapRFQ(network, dexKey, dexHelper, config);

    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    airswapRfq.initializePricing(blocknumber);
    await sleep(5000);

    let isBlacklisted = await airswapRfq.isBlacklisted(
      '0x6dac5CAc7bbCCe4DB3c1Cc5c8FE39DcDdE52A36F',
    );
    expect(isBlacklisted).toBe(true);
    isBlacklisted = await airswapRfq.isBlacklisted(
      '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
    );
    expect(isBlacklisted).toBe(false);
  });

  afterAll(() => {
    stopServer();
  });
});
