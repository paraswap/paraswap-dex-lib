import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {
  ParaSwapLimitOrderResponse,
  ParaSwapPriceSummaryResponse,
} from './types';
import { DummyLimitOrderProvider } from '../../dex-helper/index';
import { generateConfig } from '../../config';

describe('ParaSwapLimitOrders E2E', () => {
  const dexKey = 'ParaSwapLimitOrders';

  describe('ParaSwapLimitOrders ROPSTEN', () => {
    const network = Network.ROPSTEN;
    const tokens = Tokens[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'DAI';
    const tokenBSymbol: string = 'WETH';

    // Do not change arbitrarily. Need to adjust the orders amounts too
    const tokenAAmount: string = '50000000000000000000';
    const tokenBAmount: string = '110000000000000000';

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      // [SwapSide.BUY, [
      //   ContractMethod.simpleBuy,
      //   ContractMethod.buy
      // ]],
    ]);
    const maker = '0xc3643bC869DC0dcd2Df8729fC3cb768d4F86F57a';
    const taker = '0xCf8C4a46816b146Ed613d23f6D22e1711915d653';

    const priceSummaryToUse: ParaSwapPriceSummaryResponse[] = [
      {
        cumulativeMakerAmount: '10000000000000000000',
        cumulativeTakerAmount: '20000000000000000',
      },
      {
        cumulativeMakerAmount: '60000000000000000000',
        cumulativeTakerAmount: '130000000000000000',
      },
      {
        cumulativeMakerAmount: '130000000000000000000',
        cumulativeTakerAmount: '300000000000000000',
      },
    ];

    const ordersToUse: ParaSwapLimitOrderResponse[] = [
      {
        order: {
          nonceAndMeta:
            '6845735429342786815130681271919807714789080615235334578045452288',
          expiry: '0',
          makerAsset: tokens[tokenASymbol].address,
          takerAsset: tokens[tokenBSymbol].address,
          maker,
          taker: '0x0000000000000000000000000000000000000000',
          makerAmount: '10000000000000000000',
          takerAmount: '20000000000000000',
        },
        signature:
          '0xa75880885e92ed7d46c842d3d20138c60c33c411642ec33a82b73216c508b5503bc57a3ec4fcc2f8ece2477c9eb9716850ae8b97f64d86afac56d3dace8f9f701b',
        takerTokenFillAmount: '20000000000000000',
        permitTakerAsset: '0x',
        permitMakerAsset: '0x',
      },
      {
        order: {
          nonceAndMeta:
            '11585127861177800418865894644506682666974354234368387567816015872',
          expiry: '0',
          makerAsset: tokens[tokenASymbol].address,
          takerAsset: tokens[tokenBSymbol].address,
          maker,
          taker: '0x0000000000000000000000000000000000000000',
          makerAmount: '50000000000000000000',
          takerAmount: '110000000000000000',
        },
        signature:
          '0x33ce6d9a609190d3d936c0cac2609ab13ad9aaa64d79917d32064003903105302cb80dcf0133e102d513a45c61d9b813a9c85b2f627aec7fed53d858dad90df61c',
        takerTokenFillAmount: '110000000000000000',
        permitTakerAsset: '0x',
        permitMakerAsset: '0x',
      },
      {
        order: {
          nonceAndMeta:
            '11375705433687422051822427911677732183148366573414372269099057152',
          expiry: '0',
          makerAsset: tokens[tokenASymbol].address,
          takerAsset: tokens[tokenBSymbol].address,
          maker,
          taker: '0x0000000000000000000000000000000000000000',
          makerAmount: '70000000000000000000',
          takerAmount: '170000000000000000',
        },
        signature:
          '0x989eec978c60b1104c7133beae1da691353d138f1fe32862e75a9fc36d294e92655e327fcaa83b6506c6712268ea03423249714308418955dfcc067583fd823a1b',
        takerTokenFillAmount: '170000000000000000',
        permitTakerAsset: '0x',
        permitMakerAsset: '0x',
      },
    ];

    const dummyLimitOrderProvider = new DummyLimitOrderProvider();
    dummyLimitOrderProvider.setOrdersToExecute(network, ordersToUse);
    dummyLimitOrderProvider.setPriceSummary(
      network,
      tokens[tokenBSymbol].address,
      tokens[tokenASymbol].address,
      priceSummaryToUse,
    );

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it(`${network} ${side} ${contractMethod} ${tokenASymbol} -> ${tokenBSymbol}`, async () => {
            await testE2E(
              tokens[tokenBSymbol],
              tokens[tokenASymbol],
              taker,
              side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
              undefined,
              dummyLimitOrderProvider,
            );
          });
        });
      }),
    );
  });
});
