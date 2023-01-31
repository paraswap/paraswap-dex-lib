/* eslint-disable no-console */
// npx jest src/dex/balancer-v2/balancer-v2-gyro2.test.ts
import dotenv from 'dotenv';
dotenv.config();
import { Interface } from '@ethersproject/abi';

import { DummyDexHelper } from '../../dex-helper/index';
import { Network } from '../../constants';
import { BalancerV2EventPool } from './balancer-v2';
import { BalancerConfig } from './config';
import { Tokens } from '../../../tests/constants-e2e';
import {
  BalancerPoolTypes,
  PoolState,
  SubgraphMainToken,
  SubgraphPoolBase,
} from './types';
import { Gyro2Pool } from './Gyro2Pool';
import VaultABI from '../../abi/balancer-v2/vault.json';

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
const tokenIn = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
const tokenOut = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';
let gyro2PoolSg: SubgraphPoolBase;
let gyro2PoolState: PoolState;

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
      gyro2PoolSg = gyro2[0];
      expect(gyro2PoolSg.tokens.length).toBe(2);
      const sqrtAlpha = parseFloat(gyro2PoolSg.sqrtAlpha);
      const sqrtBeta = parseFloat(gyro2PoolSg.sqrtBeta);
      expect(sqrtAlpha > 0).toBe(true);
      expect(sqrtBeta > 0).toBe(true);
    });
    it('getOnChainState', async function () {
      const state = await balancerPools.getOnChainState(
        [gyro2PoolSg],
        blocknumber,
      );
      gyro2PoolState = state[gyro2PoolSg.address];
      expect(gyro2PoolState.swapFee).toBe(BigInt('200000000000000'));
      expect(gyro2PoolState.tokens[tokenIn].balance).toBe(
        BigInt('18681901532'),
      );
      expect(gyro2PoolState.tokens[tokenOut].balance).toBe(
        BigInt('18724583701712070442033'),
      );
    });
    it('parsePoolPairData -  All values should be normalised to 18 decimals', async function () {
      const vaultInterface = new Interface(VaultABI);
      const gyro2Pool = new Gyro2Pool(config.vaultAddress, vaultInterface);
      // Setting to hard values as Subgraph will change over time
      gyro2PoolSg.sqrtAlpha = '1';
      gyro2PoolSg.sqrtBeta = '2';
      const pairData = gyro2Pool.parsePoolPairData(
        gyro2PoolSg,
        gyro2PoolState,
        tokenIn,
        tokenOut,
      );
      expect(pairData.indexIn).toBe(0);
      expect(pairData.indexOut).toBe(1);
      expect(pairData.swapFee).toBe(BigInt('200000000000000'));
      expect(pairData.sqrtAlpha).toBe(BigInt('1000000000000000000'));
      expect(pairData.sqrtBeta).toBe(BigInt('2000000000000000000'));
      expect(pairData.balances).toStrictEqual([
        BigInt('18681901532000000000000'),
        BigInt('18724583701712070442033'),
      ]);
    });
  });
});
