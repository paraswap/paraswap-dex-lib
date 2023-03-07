/* eslint-disable no-console */
// npx jest src/dex/balancer-v2/balancer-v2-gyro3.test.ts
import dotenv from 'dotenv';
dotenv.config();
import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';

import { Tokens } from '../../../tests/constants-e2e';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BalancerV2EventPool } from './balancer-v2';
import { BalancerConfig } from './config';
import { BalancerPoolTypes, PoolState, SubgraphPoolBase } from './types';
import { Gyro3Pool, Gyro3PoolPairData } from './Gyro3Pool';

import VaultABI from '../../abi/balancer-v2/vault.json';

const dexKey = 'BalancerV2';
const network = Network.POLYGON;
const config = BalancerConfig[dexKey][network];
const vaultInterface = new Interface(VaultABI);
const gyro3Pool = new Gyro3Pool(config.vaultAddress, vaultInterface);
const tokens = Tokens[network];

describe('BalancerV2', () => {
  describe('Gyro3 Pool', () => {
    describe('Pool Fetching', () => {
      let Gyro3PoolSg: SubgraphPoolBase;
      let Gyro3PoolState: PoolState;
      const dexHelper = new DummyDexHelper(network);
      const logger = dexHelper.getLogger(dexKey);
      const balancerPools = new BalancerV2EventPool(
        dexKey,
        network,
        config.vaultAddress,
        config.subgraphURL,
        dexHelper,
        logger,
      );
      it('should be supported pool type', async function () {
        expect(balancerPools.isSupportedPool('Gyro3')).toBe(true);
      });
      it('should be event supported', async function () {
        expect(
          balancerPools.eventSupportedPoolTypes.includes(
            BalancerPoolTypes.Gyro3,
          ),
        ).toBe(true);
      });
      it('should fetch Gyro3 Pool with correct fields from Subgraph', async function () {
        const pools = await balancerPools.fetchAllSubgraphPools();
        // USDC/BUSD/USDT
        const Gyro3PoolId =
          '0x17f1ef81707811ea15d9ee7c741179bbe2a63887000100000000000000000799';
        const Gyro3 = pools.filter(p => p.id === Gyro3PoolId);
        expect(Gyro3.length).toBe(1);
        Gyro3PoolSg = Gyro3[0];
        expect(Gyro3PoolSg.tokens.length).toBe(3);
        const root3Alpha = parseFloat(Gyro3PoolSg.root3Alpha);
        expect(root3Alpha > 0).toBe(true);
        Gyro3PoolSg = { ...Gyro3PoolSg };
        Gyro3PoolSg.root3Alpha = '0.9995';
      });
      it('getOnChainState', async function () {
        const blocknumber = 40038397;
        const state = await balancerPools.getOnChainState(
          [Gyro3PoolSg],
          blocknumber,
        );
        Gyro3PoolState = state[Gyro3PoolSg.address];
        expect(Gyro3PoolState.swapFee).toBe(BigInt('300000000000000'));
        expect(Gyro3PoolState.tokens[tokens.USDC.address].balance).toBe(
          BigInt('25755475662'),
        );
        expect(
          Gyro3PoolState.tokens[tokens.BUSD.address.toLowerCase()].balance,
        ).toBe(BigInt('41279070738726640173873'));
        expect(
          Gyro3PoolState.tokens[tokens.USDT.address.toLowerCase()].balance,
        ).toBe(BigInt('25601127342'));
      });
      it('parsePoolPairData', async function () {
        const tokenIn = tokens.BUSD.address;
        const tokenOut = tokens.USDT.address;
        const pairData = gyro3Pool.parsePoolPairData(
          Gyro3PoolSg,
          Gyro3PoolState,
          tokenIn,
          tokenOut,
        );
        expect(pairData.indexIn).toBe(1);
        expect(pairData.indexOut).toBe(2);
        expect(pairData.swapFee).toBe(BigInt('300000000000000'));
        expect(pairData.balanceTertiary.toString()).toBe(
          '25755475662000000000000',
        );
        expect(pairData.decimalsTertiary.toString()).toBe('6');
        expect(pairData.balances).toStrictEqual([
          BigNumber.from('25755475662000000000000'),
          BigNumber.from('41279070738726640173873'),
          BigNumber.from('25601127342000000000000'),
        ]);
        expect(pairData.root3Alpha.toString()).toBe('999500000000000000');
      });
    });
    describe('Swap Functions', () => {
      describe('Swap Functions  - 6decimals>18decimals', () => {
        const pairData: Gyro3PoolPairData = {
          balances: [
            BigNumber.from('25755475662000000000000'),
            BigNumber.from('41279070738726640173873'),
            BigNumber.from('25601127342000000000000'),
          ],
          indexIn: 0,
          indexOut: 1,
          swapFee: BigInt('300000000000000'),
          scalingFactors: [
            BigInt('1000000000000000000000000000000'),
            BigInt('1000000000000000000'),
            BigInt('1000000000000000000000000000000'),
          ],
          balanceTertiary: BigNumber.from('25601127342000000000000'),
          decimalsTertiary: 6,
          root3Alpha: BigNumber.from('999500000000000000'),
        };
        it('getSwapMaxAmount', async () => {
          const swapMaxAmount = gyro3Pool.getSwapMaxAmount(
            pairData,
            SwapSide.SELL,
          );
          expect(swapMaxAmount).toBe(BigInt('41279029459'));
        });
        it('swap', async function () {
          const amountIn = BigInt('13500000');
          const amountOut = gyro3Pool.onSell([amountIn], pairData);
          expect(amountOut.length).toBe(1);
          expect(amountOut[0].toString()).toBe('13499339792532290017');
        });
      });
      describe('Swap Functions  - 18decimals>6decimals', () => {
        const pairData: Gyro3PoolPairData = {
          balances: [
            BigNumber.from('25755475662000000000000'),
            BigNumber.from('41279070738726640173873'),
            BigNumber.from('25601127342000000000000'),
          ],
          indexIn: 1,
          indexOut: 2,
          swapFee: BigInt('300000000000000'),
          scalingFactors: [
            BigInt('1000000000000000000000000000000'),
            BigInt('1000000000000000000'),
            BigInt('1000000000000000000000000000000'),
          ],
          balanceTertiary: BigNumber.from('25601127342000000000000'),
          decimalsTertiary: 6,
          root3Alpha: BigNumber.from('999500000000000000'),
        };
        it('getSwapMaxAmount', async () => {
          const swapMaxAmount = gyro3Pool.getSwapMaxAmount(
            pairData,
            SwapSide.SELL,
          );
          expect(swapMaxAmount).toBe(BigInt('25601101740872658000000'));
        });
        it('swap', async function () {
          const amountIn = BigInt('13500000000000000000');
          const amountOut = gyro3Pool.onSell([amountIn], pairData);
          expect(amountOut.length).toBe(1);
          expect(amountOut[0].toString()).toBe('13492521');
        });
      });
    });
  });
});
