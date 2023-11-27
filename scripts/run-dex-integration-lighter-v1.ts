/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Network, SwapSide } from '../src/constants';
import { LighterV1 } from '../src/dex/lighter-v1/lighter-v1';
import { DummyDexHelper } from '../src/dex-helper/index';
import { BI_POWS } from '../src/bigint-constants';
import { LighterV1EventPool } from '../src/dex/lighter-v1/lighter-v1-pool';

const WETH = {
  address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  decimals: 18,
};

const USDCe = {
  address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  decimals: 6,
};

const USDC = {
  address: '0xcC4a8FA63cE5C6a7f4A7A3D2EbCb738ddcD31209',
  decimals: 6,
};

const amounts = [2000000000000000000n];

async function main() {
  const dexHelper = new DummyDexHelper(Network.ARBITRUM);
  const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();

  const lighterV1 = new LighterV1(Network.ARBITRUM, 'LighterV1', dexHelper);

  await lighterV1.initializePricing(blocknumber);

  const pool: LighterV1EventPool | undefined = lighterV1.orderBooks.get(0);
  if (!pool) {
    throw new Error('Pool not found');
  }

  // console.log('pool state: ', pool.getState(blocknumber));

  const prices = await lighterV1.getPricesVolume(
    WETH,
    USDCe,
    amounts,
    SwapSide.SELL,
    blocknumber,
  );

  console.log('WETH <> USDCe Pool Prices: ', prices);

  const helperPrice = await lighterV1.getQuoteFromHelper(
    blocknumber,
    0,
    2000000000000000000n,
    true,
  );
  console.log('helper price: ', helperPrice.toString());

  // await balancerV2.setupEventPools(blocknumber);

  // const from = MATIC;
  // const to = stMATIC;

  // const pools = await balancerV2.getPoolIdentifiers(
  //   from,
  //   to,
  //   SwapSide.SELL,
  //   blocknumber,
  // );
  // console.log('WETH <> DAI Pool Identifiers: ', pools);

  // const prices = await balancerV2.getPricesVolume(
  //   from,
  //   to,
  //   amounts,
  //   SwapSide.SELL,
  //   blocknumber,
  //   pools,
  // );
  // console.log('WETH <> DAI Pool Prices: ', prices);

  // const poolLiquidity = await balancerV2.getTopPoolsForToken(from.address, 10);
  // console.log('WETH Top Pools:', poolLiquidity);
}

main();
