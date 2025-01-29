/* eslint-disable no-console */
import dotenv from 'dotenv';
import { testGasEstimation } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { ContractMethodV6 } from '@paraswap/core';

dotenv.config();

describe('UniswapV3 Gas Estimation', () => {
  const dexKey = 'UniswapV3';
  const network = Network.MAINNET;
  const srcToken = Tokens[network]['USDC'];
  const destToken = Tokens[network]['USDT'];
  const methods: ContractMethodV6[] = [
    ContractMethodV6.swapExactAmountInOnUniswapV3,
    ContractMethodV6.swapExactAmountIn,
  ];
  const amount = 1111100000n;

  methods.forEach(async method => {
    it(method, async () => {
      await testGasEstimation(
        network,
        srcToken,
        destToken,
        amount,
        SwapSide.SELL,
        dexKey,
        method,
      );
    });
  });

  it('Wrap `swapExactAmountInOnUniswapV3`', async () => {
    await testGasEstimation(
      network,
      Tokens[network]['ETH'],
      destToken,
      100000000000000000n,
      SwapSide.SELL,
      dexKey,
      ContractMethodV6.swapExactAmountInOnUniswapV3,
    );
  });

  it('Unwrap `swapExactAmountInOnUniswapV3`', async () => {
    await testGasEstimation(
      network,
      srcToken,
      Tokens[network]['ETH'],
      amount,
      SwapSide.SELL,
      dexKey,
      ContractMethodV6.swapExactAmountInOnUniswapV3,
    );
  });
});
