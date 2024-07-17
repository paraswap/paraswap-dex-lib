import dotenv from 'dotenv';
import { ContractMethod, Network } from '../../constants';
import { testForNetwork } from '../curve-v1-factory/curve-v1-factory-e2e.test';
import { SwapSide } from '@paraswap/core';

dotenv.config();

describe('CurveV1StableNG E2E', () => {
  const dexKey = 'CurveV1StableNg';

  const sidesToContractMethods = new Map([
    [
      SwapSide.SELL,
      [ContractMethod.swapExactAmountIn, ContractMethod.directCurveV1Swap],
    ],
    [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
    // [
    //   SwapSide.SELL,
    //   [
    //     ContractMethod.simpleSwap,
    //     ContractMethod.multiSwap,
    //     ContractMethod.megaSwap,
    //   ],
    // ],
    // [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
  ]);

  describe('Mainnet', () => {
    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          // ContractMethod.swapExactAmountIn
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.swapExactAmountOut
          ContractMethod.simpleBuy,
          ContractMethod.buy,
        ],
      ],
    ]);
    const network = Network.MAINNET;

    describe('GHO -> USDe', () => {
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
        sideToContractMethods,
      );
    });

    describe('weETH -> ETH', () => {
      const tokenASymbol: string = 'weETH';
      const tokenBSymbol: string = 'ETH';

      const tokenAAmount: string = '1000000000000000000';
      const tokenBAmount: string = '1000000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
        sidesToContractMethods,
      );
    });

    describe('GHO -> crvUSD', () => {
      const tokenASymbol: string = 'GHO';
      const tokenBSymbol: string = 'crvUSD';

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
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          // ContractMethod.swapExactAmountIn
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.swapExactAmountOut
          ContractMethod.simpleBuy,
          ContractMethod.buy,
        ],
      ],
    ]);

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
        sideToContractMethods,
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
        sidesToContractMethods,
      );
    });
  });

  describe('Fantom', () => {
    const network = Network.FANTOM;

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          // ContractMethod.swapExactAmountIn
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.swapExactAmountOut
          ContractMethod.simpleBuy,
          ContractMethod.buy,
        ],
      ],
    ]);

    const tokenASymbol: string = 'scrvUSDC_e';
    const tokenBSymbol: string = 'scrvUSDC_p';

    const tokenAAmount: string = '20232903693079';
    const tokenBAmount: string = '40232903693079';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      sideToContractMethods,
    );
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          // ContractMethod.swapExactAmountIn
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.swapExactAmountOut
          ContractMethod.simpleBuy,
          ContractMethod.buy,
        ],
      ],
    ]);

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
      sideToContractMethods,
    );
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          // ContractMethod.swapExactAmountIn
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.swapExactAmountOut
          ContractMethod.simpleBuy,
          ContractMethod.buy,
        ],
      ],
    ]);

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
      sideToContractMethods,
    );
  });

  describe('Base', () => {
    const network = Network.BASE;

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          // ContractMethod.swapExactAmountIn
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [
        SwapSide.BUY,
        [
          // ContractMethod.swapExactAmountOut
          ContractMethod.simpleBuy,
          ContractMethod.buy,
        ],
      ],
    ]);

    const tokenASymbol: string = 'USDC';
    const tokenBSymbol: string = 'USDM';

    const tokenAAmount: string = '11100000';
    const tokenBAmount: string = '1000000000000000000';

    testForNetwork(
      network,
      dexKey,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
      sideToContractMethods,
    );
  });
});
