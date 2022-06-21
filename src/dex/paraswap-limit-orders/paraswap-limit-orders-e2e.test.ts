import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens } from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {
  ParaswapLimitOrderResponse,
  ParaswapPriceSummaryResponse,
} from './types';
import { DummyLimitOrderProvider } from '../../dex-helper/index';

describe('ParaswapLimitOrders E2E', () => {
  const dexKey = 'ParaswapLimitOrders';

  describe('ParaswapLimitOrders ROPSTEN', () => {
    const network = Network.ROPSTEN;
    const tokens = Tokens[network];
    const provider = new StaticJsonRpcProvider(ProviderURL[network], network);

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

    const priceSummaryToUse: ParaswapPriceSummaryResponse[] = [
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

    const ordersToUse: ParaswapLimitOrderResponse[] = [
      {
        order: {
          nonceAndMeta:
            '5435258417207634316802526407953398312487658309480619000381571072',
          expiry: '0',
          makerAsset: tokens[tokenASymbol].address,
          takerAsset: tokens[tokenBSymbol].address,
          maker,
          taker: '0x0000000000000000000000000000000000000000',
          makerAmount: '10000000000000000000',
          takerAmount: '20000000000000000',
        },
        signature:
          '0xfff663003ac2b45b5ae2df251704b1ad397d548296c28c3dcf553e15e2aaaddd1e5d11821cac31c99cb5e15ba0eea1c061248c239945a1b9160b58be0929bedf1c',
        takerTokenFillAmount: '20000000000000000',
        permitTakerAsset: '0x',
        permitMakerAsset: '0x',
      },
      {
        order: {
          nonceAndMeta:
            '1527934870675942314274036667041453450196632870313936044039340032',
          expiry: '0',
          makerAsset: tokens[tokenASymbol].address,
          takerAsset: tokens[tokenBSymbol].address,
          maker,
          taker: '0x0000000000000000000000000000000000000000',
          makerAmount: '50000000000000000000',
          takerAmount: '110000000000000000',
        },
        signature:
          '0x3ed504f3f5bd0d153f732a640b8d91680fee0bc7b5b8d72e6ac4a847aaaf220e738ee484c55ab27d5b6f85e26c5881de8f8b4c01f0d636d2e3a3b84def850e2b1c',
        takerTokenFillAmount: '110000000000000000',
        permitTakerAsset: '0x',
        permitMakerAsset: '0x',
      },
      {
        order: {
          nonceAndMeta:
            '455025777483691928005249310928740964642195687096708235985420288',
          expiry: '0',
          makerAsset: tokens[tokenASymbol].address,
          takerAsset: tokens[tokenBSymbol].address,
          maker,
          taker: '0x0000000000000000000000000000000000000000',
          makerAmount: '70000000000000000000',
          takerAmount: '170000000000000000',
        },
        signature:
          '0x3820a6a550841c62034338f4380ad9317b8657bc70f11941ce2f022caa80f7a728a99507b4f81f1d29a37d36ee9252bcd8b809b586d5254b0db6885b1da077c61b',
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
