/* eslint-disable no-console */
import dotenv from 'dotenv';
import { testGasEstimation } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { ContractMethodV6 } from '@paraswap/core';
import { ethers } from 'ethers';

dotenv.config();

describe('RingV2 Gas Estimation', () => {
  const dexKey = 'RingV2';
  const network = Network.MAINNET;
  const tokens = Tokens[network];
  // const ETH = tokens['AWESOME1'];
  const WETH = tokens['WETH'];
  // const USDT = tokens['USDT'];
  const DAI = tokens['DAI'];
  // const USDC = tokens['USDC'];
  // const WBTC = tokens['WBTC'];
  const amount = 100000000n; // 100 usdt

  const methods: ContractMethodV6[] = [
    //ringtodo, why paraswap-sdk has no ring-v2
    ContractMethodV6.swapExactAmountInOnRingV2,
    ContractMethodV6.swapExactAmountInOnUniswapV2,
    // ContractMethodV6.swapExactAmountIn,
  ];

  methods.forEach(async method => {
    describe(method, () => {
      it('one swap on testnet', async () => {
        await testGasEstimation(
          network,
          DAI,
          WETH,
          amount,
          SwapSide.SELL,
          dexKey,
          method,
        );
      });

      // it('one swap', async () => {
      //   console.log('RingV2 Gas Estimation Tests, for swap and buy');
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
