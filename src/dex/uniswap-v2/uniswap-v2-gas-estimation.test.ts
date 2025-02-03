/* eslint-disable no-console */
import 'dotenv/config';
import { testGasEstimation } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { ContractMethodV6 } from '@paraswap/core';
import { ethers } from 'ethers';

describe('UniswapV2 Gas Estimation', () => {
  const dexKey = 'UniswapV2';
  const network = Network.MAINNET;

  describe('swapExactAmountInOnUniswapV2', () => {
    const ETH = Tokens[network]['ETH'];
    const WETH = Tokens[network]['WETH'];
    const USDT = Tokens[network]['USDT'];
    const USDC = Tokens[network]['USDC'];
    const amount = 100000000n; // 100 usdt

    it('one swap', async () => {
      await testGasEstimation(
        network,
        USDT,
        USDC,
        amount,
        SwapSide.SELL,
        dexKey,
        ContractMethodV6.swapExactAmountInOnUniswapV2,
      );
    });

    it('one swap with unwrap', async () => {
      await testGasEstimation(
        network,
        USDT,
        ETH,
        amount,
        SwapSide.SELL,
        dexKey,
        ContractMethodV6.swapExactAmountInOnUniswapV2,
      );
    });

    it('one swap with wrap', async () => {
      const oneEth = ethers.utils.parseEther('1').toBigInt();

      await testGasEstimation(
        network,
        ETH,
        USDT,
        oneEth,
        SwapSide.SELL,
        dexKey,
        ContractMethodV6.swapExactAmountInOnUniswapV2,
      );
    });
  });
});
