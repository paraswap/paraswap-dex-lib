import dotenv from 'dotenv';
dotenv.config();

import { Network, SwapSide, BIs } from '../src/constants';
import { BalancerV2 } from '../src/dex/balancer-v2/balancer-v2';
import { DummyDexHelper } from '../src/dex-helper/index';

const WETH = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
};

const DAI = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18,
};

const USDC = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6,
};

// Example for checking metaStable Pool, i.e. WETH<>wstETH
const wstETH = {
  address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
  decimals: 18,
};

// Example for checking PhantomStable Pool,
// i.e. bbausd<>bbausdc for BPT>token
// i.e. bbausdc<>bbadai for token>token
const bbausd = {
  address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
  decimals: 18,
};

const bbausdc = {
  address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
  decimals: 18,
};

const bbadai = {
  address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
  decimals: 18,
};

const amounts = [BIs[0], BIs.POWS[18], BigInt('2000000000000000000')];

async function main() {
  const dexHelper = new DummyDexHelper(Network.MAINNET);
  const blocknumber = await dexHelper.provider.getBlockNumber();

  const balancerV2 = new BalancerV2(Network.MAINNET, 'BalancerV2', dexHelper);

  await balancerV2.setupEventPools(blocknumber);

  const from = bbausd;
  const to = bbadai;

  const pools = await balancerV2.getPoolIdentifiers(
    from,
    to,
    SwapSide.SELL,
    blocknumber,
  );
  console.log('WETH <> DAI Pool Identifiers: ', pools);

  const prices = await balancerV2.getPricesVolume(
    from,
    to,
    amounts,
    SwapSide.SELL,
    blocknumber,
    pools,
  );
  console.log('WETH <> DAI Pool Prices: ', prices);

  const poolLiquidity = await balancerV2.getTopPoolsForToken(from.address, 10);
  console.log('WETH Top Pools:', poolLiquidity);
}

main();
