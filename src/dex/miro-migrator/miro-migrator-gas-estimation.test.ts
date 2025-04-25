/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testGasEstimation } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { ContractMethodV6 } from '@paraswap/core';

describe('MiroMigrator Gas Estimation', () => {
  const dexKey = 'MiroMigrator';
  const network = Network.MAINNET;

  describe('swapExactAmountIn', () => {
    const PSP = Tokens[network]['testPSP'];
    const XYZ = Tokens[network]['testXYZ'];
    const amount = 10000000000000000000n;

    it('SELL -> migratePSPtoXYZ', async () => {
      await testGasEstimation(
        network,
        PSP,
        XYZ,
        amount,
        SwapSide.SELL,
        dexKey,
        ContractMethodV6.swapExactAmountIn,
      );
    });

    it('BUY -> migratePSPtoXYZ', async () => {
      await testGasEstimation(
        network,
        PSP,
        XYZ,
        amount,
        SwapSide.BUY,
        dexKey,
        ContractMethodV6.swapExactAmountOut,
      );
    });
  });
});
