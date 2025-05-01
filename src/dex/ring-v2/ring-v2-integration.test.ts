import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { RingV2 } from './ring-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';

const WETH = {
  address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  decimals: 18,
};

//mainnet, test for mainnet, ethereum
const USDC = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6,
};

const fwWBTC = {
  address: '0x2078f336fdd260f708bec4a20c82b063274e1b23',
  decimals: 8,
};

const taoPad = {
  address: '0x5483dc6abda5f094865120b2d251b5744fc2ecb5',
  decimals: 18,
};

const USDT = {
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  decimals: 6,
};

const fwUSDC = {
  address: '0x76AC72683C5b7F22C6B5Ed85B5B1511702464F7e',
  decimals: 18,
};

const fwDAI = {
  address: '0x09D8486e42Aa76229a563bFa0f07CA301aCd29C9',
  decimals: 18,
};

const DAI = {
  address: '0x5fbad067f69eBbc276410D78fF52823be133eD48',
  decimals: 18,
};

// const DAI = {
//   address: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11',
//   decimals: 18,
// };

const AWESOME1 = {
  address: '0x63DC6b0f80d067aF637C69b21949caA475AB813C',
  decimals: 18,
};

const AWESOME2 = {
  address: '0xF8415EeE2509FCD26C392ECC9844D13c1Ad9c3E7',
  decimals: 18,
};

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'RingV2';

describe('RingV2', function () {
  console.log('RingV2 Integration Tests');
  /** pass*/
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(Network.SEPOLIA);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const ringV2 = new RingV2(Network.SEPOLIA, dexKey, dexHelper);

    const pools = await ringV2.getPoolIdentifiers(
      fwUSDC,
      fwDAI,
      // AWESOME1,
      // AWESOME2,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('WETH <> DAI Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);
  });

  /** pass
    const poolPrices = await ringV2.getPricesVolume(
      fwUSDC,
      fwDAI,
      // AWESOME1,
      // AWESOME2,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('WETH <> DAI Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });
   */

  //here use ring.info's subgraph

  /** pass
  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(Network.MAINNET);
    const ringV2 = new RingV2(Network.MAINNET, dexKey, dexHelper);

    const poolLiquidity = await ringV2.getTopPoolsForToken(
      fwWBTC.address,
      10,
    );
    console.log('WBTC Top Pools:', poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, fwWBTC.address, dexKey);
  });
   */
});
