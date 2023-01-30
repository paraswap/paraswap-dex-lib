/* eslint-disable no-console */
// npx jest src/dex/balancer-v2/balancer-v2-gyro2.test.ts
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network } from '../../constants';
import { BalancerV2EventPool } from './balancer-v2';
import { BalancerConfig } from './config';
import { Tokens } from '../../../tests/constants-e2e';
import { BalancerPoolTypes } from './types';

const dexKey = 'BalancerV2';
const network = Network.POLYGON;

const config = BalancerConfig[dexKey][network];
const dexHelper = new DummyDexHelper(network);
const tokens = Tokens[network];
const logger = dexHelper.getLogger(dexKey);
const blocknumber = 15731000;

const balancerPools = new BalancerV2EventPool(
  dexKey,
  network,
  config.vaultAddress,
  config.subgraphURL,
  dexHelper,
  logger,
);

describe('BalancerV2', function () {
  describe('Gyro2 Pool', () => {
    it('should be event supported', async function () {
      expect(
        balancerPools.eventSupportedPoolTypes.includes(BalancerPoolTypes.Gyro2),
      ).toBe(true);
    });
    it('should fetch Gyro2 Pool with correct fields from Subgraph', async function () {
      const pools = await balancerPools.fetchAllSubgraphPools();
      // DAI/USDC
      const gyro2 = pools.filter(
        p =>
          p.id ===
          '0xdac42eeb17758daa38caf9a3540c808247527ae3000200000000000000000a2b',
      );
      expect(gyro2.length).toBe(1);
      expect(gyro2[0].tokens.length).toBe(2);
      const sqrtAlpha = parseFloat(gyro2[0].sqrtAlpha);
      const sqrtBeta = parseFloat(gyro2[0].sqrtBeta);
      expect(sqrtAlpha > 0).toBe(true);
      expect(sqrtBeta > 0).toBe(true);
    });
    // it('getPoolIdentifiers and getPricesVolume', async function () {
    //   const state = await balancerPools.getOnChainState(
    //     [
    //       {
    //         id: BBAUSDT_PoolId,
    //         address: tokens.BBAUSDT.address,
    //         poolType: BalancerPoolTypes.AaveLinear,
    //         mainIndex: 1,
    //         wrappedIndex: 0,
    //         tokens: [tokens.BBAUSDT, tokens.aUSDT, tokens.USDT],
    //         mainTokens: [],
    //       },
    //     ],
    //     blocknumber,
    //   );

    //   expect(
    //     state[tokens.BBAUSDT.address].tokens[
    //       tokens.BBAUSDT.address
    //     ].scalingFactor!.toString(),
    //   ).toBe('1015472217207213567');
    // });
  });
});
