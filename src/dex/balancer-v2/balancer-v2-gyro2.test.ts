/* eslint-disable no-console */
// npx jest src/dex/balancer-v2/balancer-v2-gyro2.test.ts
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network } from '../../constants';
import { BalancerV2EventPool } from './balancer-v2';
import { BalancerConfig } from './config';
import { Tokens } from '../../../tests/constants-e2e';
import {
  BalancerPoolTypes,
  SubgraphMainToken,
  SubgraphPoolBase,
} from './types';

const dexKey = 'BalancerV2';
const network = Network.POLYGON;

const config = BalancerConfig[dexKey][network];
const dexHelper = new DummyDexHelper(network);
const tokens = Tokens[network];
const logger = dexHelper.getLogger(dexKey);
const blocknumber = 38708647;

const balancerPools = new BalancerV2EventPool(
  dexKey,
  network,
  config.vaultAddress,
  config.subgraphURL,
  dexHelper,
  logger,
);

const gyro2PoolId =
  '0xdac42eeb17758daa38caf9a3540c808247527ae3000200000000000000000a2b';
let gyro2Pool: SubgraphPoolBase;

describe('BalancerV2', function () {
  describe('Gyro2 Pool', () => {
    it('should be supported pool type', async function () {
      expect(balancerPools.isSupportedPool('Gyro2')).toBe(true);
    });
    it('should be event supported', async function () {
      expect(
        balancerPools.eventSupportedPoolTypes.includes(BalancerPoolTypes.Gyro2),
      ).toBe(true);
    });
    it('should fetch Gyro2 Pool with correct fields from Subgraph', async function () {
      const pools = await balancerPools.fetchAllSubgraphPools();
      // DAI/USDC
      const gyro2 = pools.filter(p => p.id === gyro2PoolId);
      expect(gyro2.length).toBe(1);
      gyro2Pool = gyro2[0];
      expect(gyro2Pool.tokens.length).toBe(2);
      const sqrtAlpha = parseFloat(gyro2Pool.sqrtAlpha);
      const sqrtBeta = parseFloat(gyro2Pool.sqrtBeta);
      expect(sqrtAlpha > 0).toBe(true);
      expect(sqrtBeta > 0).toBe(true);
    });
    it('getOnChainState', async function () {
      const state = await balancerPools.getOnChainState(
        [gyro2Pool],
        blocknumber,
      );
      const gyroState = state[gyro2Pool.address];
      expect(gyroState.swapFee).toBe(BigInt('200000000000000'));
      expect(
        gyroState.tokens['0x2791bca1f2de4661ed88a30c99a7a9449aa84174'].balance,
      ).toBe(BigInt('18681901532'));
      expect(
        gyroState.tokens['0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'].balance,
      ).toBe(BigInt('18724583701712070442033'));
    });
  });
});
