import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../constants';
import { DummyDexHelper } from '../dex-helper';
import { Executor02BytecodeBuilder } from './Executor02BytecodeBuilder';
import { OptimalRate } from '@paraswap/core';
import { DexExchangeParam } from '../types';
import { DepositWithdrawReturn } from '../dex/weth/types';

import priceRouteSimpleSwapSushiV3UniV3SushiEth from './fixtures/executor02/routes/price-route-simpleSwap-sushiv3-univ3-sushi-eth.json';
import exchangeParamsSimpleSwapSushiV3UniV3SushiEth from './fixtures/executor02/exchange-params/price-route-simpleSwap-sushiv3-univ3-sushi-eth.json';
import maybeWethCalldataSimpleSwapSushiV3UniV3SushiEth from './fixtures/executor02/maybe-weth-calldata/price-route-simpleSwap-sushiv3-univ3-sushi-eth.json';

import priceRouteSimpleSwapSushiV3UniV3EthSushi from './fixtures/executor02/routes/price-route-simpleSwap-sushiv3-univ3-eth-sushi.json';
import exchangeParamsSimpleSwapSushiV3UniV3EthSushi from './fixtures/executor02/exchange-params/price-route-simpleSwap-sushiv3-univ3-eth-sushi.json';
import maybeWethCalldataSimpleSwapSushiV3UniV3EthSushi from './fixtures/executor02/maybe-weth-calldata/price-route-simpleSwap-sushiv3-univ3-eth-sushi.json';

import priceRouteSimpleSwapSushiV3BalancerV1EthUsdc from './fixtures/executor02/routes/price-route-simpleSwap-sushiv3-balancerv1-eth-usdc.json';
import exchangeParamsSimpleSwapSushiV3BalancerV1EthUsdc from './fixtures/executor02/exchange-params/price-route-simpleSwap-sushiv3-balancerv1-eth-usdc.json';
import maybeWethCalldataSimpleSwapSushiV3BalancerV1EthUsdc from './fixtures/executor02/maybe-weth-calldata/price-route-simpleSwap-sushiv3-balancerv1-eth-usdc.json';

import priceRouteSimpleSwapSushiV3BalancerV1UsdcEth from './fixtures/executor02/routes/price-route-simpleSwap-sushiv3-balancerv1-usdc-eth.json';
import exchangeParamsSimpleSwapSushiV3BalancerV1UsdcEth from './fixtures/executor02/exchange-params/price-route-simpleSwap-sushiv3-balancerv1-usdc-eth.json';
import maybeWethCalldataSimpleSwapSushiV3BalancerV1UsdcEth from './fixtures/executor02/maybe-weth-calldata/price-route-simpleSwap-sushiv3-balancerv1-usdc-eth.json';

import priceRouteSimpleSwapUniV3CurveV1UsdtDai from './fixtures/executor02/routes/price-route-simpleSwap-univ3-curvev1-usdt-dai.json';
import exchangeParamsSimpleSwapUniV3CurveV1UsdtDai from './fixtures/executor02/exchange-params/price-route-simpleSwap-univ3-curvev1-usdt-dai.json';

describe('Executor02BytecodeBuilder Snapshot tests', () => {
  let executor02BytecodeBuilder: Executor02BytecodeBuilder;
  beforeEach(() => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);
    executor02BytecodeBuilder = new Executor02BytecodeBuilder(dexHelper);
  });

  describe('buildByteCode', () => {
    describe('SimpleSwap', () => {
      it('should produce correct bytecode for simpleSwap ETH -> SUSHI via SushiSwapV3 and UniswapV3', () => {
        const bytecode = executor02BytecodeBuilder.buildByteCode(
          priceRouteSimpleSwapSushiV3UniV3SushiEth as unknown as OptimalRate,
          exchangeParamsSimpleSwapSushiV3UniV3SushiEth as unknown as DexExchangeParam[],
          maybeWethCalldataSimpleSwapSushiV3UniV3SushiEth as unknown as DepositWithdrawReturn,
        );

        expect(bytecode).toMatchSnapshot();
      });

      it('should produce correct bytecode for simpleSwap SUSHI -> ETH via SushiSwapV3 and UniswapV3', () => {
        const bytecode = executor02BytecodeBuilder.buildByteCode(
          priceRouteSimpleSwapSushiV3UniV3EthSushi as unknown as OptimalRate,
          exchangeParamsSimpleSwapSushiV3UniV3EthSushi as unknown as DexExchangeParam[],
          maybeWethCalldataSimpleSwapSushiV3UniV3EthSushi as unknown as DepositWithdrawReturn,
        );

        expect(bytecode).toMatchSnapshot();
      });

      it('should produce correct bytecode for simpleSwap ETH -> USDC via SushiSwapV3 and BalancerV1', () => {
        const bytecode = executor02BytecodeBuilder.buildByteCode(
          priceRouteSimpleSwapSushiV3BalancerV1EthUsdc as unknown as OptimalRate,
          exchangeParamsSimpleSwapSushiV3BalancerV1EthUsdc as unknown as DexExchangeParam[],
          maybeWethCalldataSimpleSwapSushiV3BalancerV1EthUsdc as unknown as DepositWithdrawReturn,
        );

        expect(bytecode).toMatchSnapshot();
      });

      it('should produce correct bytecode for simpleSwap USDC -> ETH via SushiSwapV3 and BalancerV1', () => {
        const bytecode = executor02BytecodeBuilder.buildByteCode(
          priceRouteSimpleSwapSushiV3BalancerV1UsdcEth as unknown as OptimalRate,
          exchangeParamsSimpleSwapSushiV3BalancerV1UsdcEth as unknown as DexExchangeParam[],
          maybeWethCalldataSimpleSwapSushiV3BalancerV1UsdcEth as unknown as DepositWithdrawReturn,
        );

        expect(bytecode).toMatchSnapshot();
      });

      it('should produce correct bytecode for simpleSwap USDT -> DAI via UniswapV3 and CurveV1', () => {
        const bytecode = executor02BytecodeBuilder.buildByteCode(
          priceRouteSimpleSwapUniV3CurveV1UsdtDai as unknown as OptimalRate,
          exchangeParamsSimpleSwapUniV3CurveV1UsdtDai as unknown as DexExchangeParam[],
          undefined, // no weth calldata
        );

        expect(bytecode).toMatchSnapshot();
      });
    });
  });
});
