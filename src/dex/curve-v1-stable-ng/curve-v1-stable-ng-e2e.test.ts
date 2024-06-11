import dotenv from 'dotenv';
import { ContractMethod, Network } from '../../constants';
import { testForNetwork } from '../curve-v1-factory/curve-v1-factory-e2e.test';
import { SwapSide } from '@paraswap/core';

dotenv.config();

describe('CurveV1StableNG E2E', () => {
  const dexKey = 'CurveV1StableNg';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    const tokenASymbol: string = 'GHO';
    const tokenBSymbol: string = 'USDe';

    const tokenAAmount: string = '100000000';
    const tokenBAmount: string = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      new Map([
        [
          SwapSide.SELL,
          [ContractMethod.swapExactAmountIn, ContractMethod.directCurveV1Swap],
        ],
        [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
      ]),
    );
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;

    describe('crvUSD -> USDT', () => {
      const tokenASymbol: string = 'crvUSD';
      const tokenBSymbol: string = 'USDT';

      const tokenAAmount: string = '1000000000000000000';
      const tokenBAmount: string = '10000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });

    describe('USDC.e -> crvUSD', () => {
      const tokenASymbol: string = 'USDCe';
      const tokenBSymbol: string = 'crvUSD';

      const tokenAAmount: string = '10000000';
      const tokenBAmount: string = '1000000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });
  });

  describe('Fantom', () => {
    const network = Network.FANTOM;

    const tokenASymbol: string = 'scrvUSDC_e';
    const tokenBSymbol: string = 'scrvUSDC_p';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    const tokenASymbol: string = 'crvUSD';
    const tokenBSymbol: string = 'USDCe';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '10000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    const tokenASymbol: string = 'crvUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = '1000000000000000000';
    const tokenBAmount: string = '10000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    );
  });
});
