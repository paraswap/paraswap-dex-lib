/* eslint-disable no-console */
import dotenv from 'dotenv';
import { testGasEstimation } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { ContractMethodV6 } from '@paraswap/core';
import { ethers } from 'ethers';

dotenv.config();

describe('UniswapV2 Gas Estimation', () => {
  const dexKey = 'UniswapV2';
  const network = Network.SEPOLIA;
  const tokens = Tokens[network];
  // const ETH = tokens['AWESOME1'];
  const WETH = tokens['WETH'];
  // const USDT = tokens['USDT'];
  const DAI = tokens['DAI'];
  // const USDC = tokens['USDC'];
  // const WBTC = tokens['WBTC'];
  const amount = 100000000n; // 100 usdt

  const methods: ContractMethodV6[] = [
    ContractMethodV6.swapExactAmountInOnUniswapV2,
    ContractMethodV6.swapExactAmountIn,
  ];

  methods.forEach(async method => {
    describe(method, () => {
      it('one swap on testnet', async () => {
        console.log('UniswapV2 Gas Estimation Tests1');
        console.log('UniswapV2 Gas Estimation Tests2');
        console.log('UniswapV2 Gas Estimation Tests3');

        await testGasEstimation(
          network,
          tokens['fwUSDC'],
          tokens['fwDAI'],
          amount,
          SwapSide.SELL,
          dexKey,
          method,
        );
      });

      // it('one swap', async () => {
      //   console.log('UniswapV2 Gas Estimation Tests, for swap and buy');
      //   await testGasEstimation(
      //     Network.MAINNET,
      //     tokens['USDC'],
      //     tokens['USDT'],
      //     amount,
      //     SwapSide.SELL,
      //     dexKey,
      //     method,
      //   );
      // });
    });
  });
});
