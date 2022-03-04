import dotenv from 'dotenv';
dotenv.config();

import { Network, SwapSide } from '../src/constants';
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

const amounts = [
  BigInt('0'),
  BigInt('1000000000000000000'),
  BigInt('2000000000000000000'),
];

async function main() {
  const dexHelper = new DummyDexHelper(Network.MAINNET);
  const blocknumber = await dexHelper.provider.getBlockNumber();

  const balancerV2 = new BalancerV2(Network.MAINNET, 'BalancerV2', dexHelper);

  await balancerV2.setupEventPools(blocknumber);

  const pools = await balancerV2.getPoolIdentifiers(
    WETH,
    DAI,
    SwapSide.SELL,
    blocknumber,
  );
  console.log('WETH <> DAI Pool Ideintifiers: ', pools);

  const prices = await balancerV2.getPricesVolume(
    WETH,
    DAI,
    amounts,
    SwapSide.SELL,
    blocknumber,
    pools,
  );
  console.log('WETH <> DAI Pool Prices: ', prices);

  const poolLiquidity = await balancerV2.getTopPoolsForToken(WETH.address, 10);
  console.log('WETH Top Pools:', poolLiquidity);
}

main();
