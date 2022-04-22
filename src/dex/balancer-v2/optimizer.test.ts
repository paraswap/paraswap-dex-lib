import dotenv from 'dotenv';
dotenv.config();
import _ from 'lodash';
import { balancerV2Merge } from './optimizer';
import { UnoptimizedRate } from '../../types';
import { SwapSide } from '../../constants';

describe('BalancerV2 Optimizer', () => {
  describe('No Virtual Pools', () => {
    it('1 Swap', async () => {
      const srcAmount = '2';
      const srcToken = 'srcToken';
      const srcDecimals = 18;
      const destAmount = '4';
      const destToken = 'destToken';
      const destDecimals = 18;
      const side: SwapSide = SwapSide.SELL;
      const swap1percent = 100;
      const swap1SrcAmount = '2';
      const swap1DestAmount = '4';

      const unoptimizedRate: UnoptimizedRate = {
        blockNumber: 1,
        network: 1,
        srcToken,
        srcDecimals,
        srcAmount,
        destToken,
        destDecimals,
        destAmount,
        bestRoute: [
          {
            percent: 100,
            swaps: [
              {
                srcToken,
                srcDecimals,
                destToken,
                destDecimals,
                swapExchanges: [
                  {
                    exchange: 'balancerV2',
                    srcAmount: swap1SrcAmount,
                    destAmount: swap1DestAmount,
                    percent: swap1percent,
                    data: { poolId: '0xFirst' },
                    poolAddresses: ['0xFirst'],
                  },
                ],
              },
            ],
          },
        ],
        gasCostUSD: '0',
        gasCost: '0',
        others: [],
        side,
        tokenTransferProxy: '', // TokenTransferProxyAddress[this.network],
        contractAddress: '', // AugustusAddress[this.network],
      };
      // const swapCopy = _.cloneDeep(unoptimizedRate.bestRoute);  // balancerV2Merge changes original param
      const optimized = balancerV2Merge(unoptimizedRate);
      expect(optimized.bestRoute.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].srcToken).toEqual(srcToken);
      expect(optimized.bestRoute[0].swaps[0].srcDecimals).toEqual(srcDecimals);
      expect(optimized.bestRoute[0].swaps[0].destToken).toEqual(destToken);
      expect(optimized.bestRoute[0].swaps[0].destDecimals).toEqual(
        destDecimals,
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].exchange).toEqual(
        'balancerV2',
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].percent).toEqual(
        100,
      );
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].srcAmount,
      ).toEqual(srcAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].destAmount,
      ).toEqual(destAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses,
      ).toEqual(['0xFirst']);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps.length,
      ).toEqual(1);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].poolId,
      ).toEqual('0xFirst');
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].amount,
      ).toEqual(swap1SrcAmount);
    });
    it('2 Swaps', async () => {
      const srcAmount = '2';
      const srcToken = 'srcToken';
      const srcDecimals = 18;
      const destAmount = '4';
      const destToken = 'destToken';
      const destDecimals = 18;
      const side: SwapSide = SwapSide.SELL;
      const swap1percent = 50;
      const swap1SrcAmount = '1';
      const swap1DestAmount = '2';
      const swap2percent = 50;
      const swap2SrcAmount = '1';
      const swap2DestAmount = '2';

      const unoptimizedRate: UnoptimizedRate = {
        blockNumber: 1,
        network: 1,
        srcToken,
        srcDecimals,
        srcAmount,
        destToken,
        destDecimals,
        destAmount,
        bestRoute: [
          {
            percent: 100,
            swaps: [
              {
                srcToken,
                srcDecimals,
                destToken,
                destDecimals,
                swapExchanges: [
                  {
                    exchange: 'balancerV2',
                    srcAmount: swap1SrcAmount,
                    destAmount: swap1DestAmount,
                    percent: swap1percent,
                    data: { poolId: '0xFirst' },
                    poolAddresses: ['0xFirst'],
                  },
                  {
                    exchange: 'balancerV2',
                    srcAmount: swap2SrcAmount,
                    destAmount: swap2DestAmount,
                    percent: swap2percent,
                    data: { poolId: '0xSecond' },
                    poolAddresses: ['0xSecond'],
                  },
                ],
              },
            ],
          },
        ],
        gasCostUSD: '0',
        gasCost: '0',
        others: [],
        side,
        tokenTransferProxy: '', // TokenTransferProxyAddress[this.network],
        contractAddress: '', // AugustusAddress[this.network],
      };
      // const swapCopy = _.cloneDeep(unoptimizedRate.bestRoute);  // balancerV2Merge changes original param
      const optimized = balancerV2Merge(unoptimizedRate);
      /*
            Example output:
            swapExchanges:
            [
                {
                    exchange: 'balancerV2',
                    srcAmount: '2',
                    destAmount: '4',
                    percent: 100,
                    poolAddresses: ['0xFirst', '0xSecond'],
                    data: { swaps: [Array], gasUSD: 'NaN', exchangeProxy: undefined }
                }
            ]
            Swaps:
            [
                { poolId: '0xFirst', amount: '1' },
                { poolId: '0xSecond', amount: '1' }
            ]
            */
      expect(optimized.bestRoute.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].srcToken).toEqual(srcToken);
      expect(optimized.bestRoute[0].swaps[0].srcDecimals).toEqual(srcDecimals);
      expect(optimized.bestRoute[0].swaps[0].destToken).toEqual(destToken);
      expect(optimized.bestRoute[0].swaps[0].destDecimals).toEqual(
        destDecimals,
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].exchange).toEqual(
        'balancerV2',
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].percent).toEqual(
        100,
      );
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].srcAmount,
      ).toEqual(srcAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].destAmount,
      ).toEqual(destAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses,
      ).toEqual(['0xFirst', '0xSecond']);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps.length,
      ).toEqual(2);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].poolId,
      ).toEqual('0xFirst');
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].amount,
      ).toEqual(swap1SrcAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[1].poolId,
      ).toEqual('0xSecond');
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[1].amount,
      ).toEqual(swap2SrcAmount);
    });
  });
  describe('With Virtual Pools', () => {
    it('1 Swap, Virtual Pool', async () => {
      const srcAmount = '2';
      const srcToken = 'srcToken';
      const srcDecimals = 18;
      const destAmount = '4';
      const destToken = 'destToken';
      const destDecimals = 18;
      const side: SwapSide = SwapSide.SELL;
      const swap1percent = 100;
      const swap1SrcAmount = '2';
      const swap1DestAmount = '4';

      const unoptimizedRate: UnoptimizedRate = {
        blockNumber: 1,
        network: 1,
        srcToken,
        srcDecimals,
        srcAmount,
        destToken,
        destDecimals,
        destAmount,
        bestRoute: [
          {
            percent: 100,
            swaps: [
              {
                srcToken,
                srcDecimals,
                destToken,
                destDecimals,
                swapExchanges: [
                  {
                    exchange: 'balancerV2',
                    srcAmount: swap1SrcAmount,
                    destAmount: swap1DestAmount,
                    percent: swap1percent,
                    data: { poolId: '0xFirst-virtualBoostedPool' },
                    poolAddresses: ['0xFirst-virtualBoostedPool'],
                  },
                ],
              },
            ],
          },
        ],
        gasCostUSD: '0',
        gasCost: '0',
        others: [],
        side,
        tokenTransferProxy: '', // TokenTransferProxyAddress[this.network],
        contractAddress: '', // AugustusAddress[this.network],
      };
      const optimized = balancerV2Merge(unoptimizedRate);
      expect(optimized.bestRoute.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].srcToken).toEqual(srcToken);
      expect(optimized.bestRoute[0].swaps[0].srcDecimals).toEqual(srcDecimals);
      expect(optimized.bestRoute[0].swaps[0].destToken).toEqual(destToken);
      expect(optimized.bestRoute[0].swaps[0].destDecimals).toEqual(
        destDecimals,
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].exchange).toEqual(
        'balancerV2',
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].percent).toEqual(
        100,
      );
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].srcAmount,
      ).toEqual(srcAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].destAmount,
      ).toEqual(destAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses,
      ).toEqual(['0xFirst-virtualBoostedPool']);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps.length,
      ).toEqual(1);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].poolId,
      ).toEqual('0xFirst-virtualBoostedPool');
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].amount,
      ).toEqual(swap1SrcAmount);
    });
    it('2 Swaps, 1 Virtual Pool', async () => {
      const srcAmount = '2';
      const srcToken = 'srcToken';
      const srcDecimals = 18;
      const destAmount = '4';
      const destToken = 'destToken';
      const destDecimals = 18;
      const side: SwapSide = SwapSide.SELL;
      const swap1percent = 50;
      const swap1SrcAmount = '1';
      const swap1DestAmount = '2';
      const swap2percent = 50;
      const swap2SrcAmount = '1';
      const swap2DestAmount = '2';

      const unoptimizedRate: UnoptimizedRate = {
        blockNumber: 1,
        network: 1,
        srcToken,
        srcDecimals,
        srcAmount,
        destToken,
        destDecimals,
        destAmount,
        bestRoute: [
          {
            percent: 100,
            swaps: [
              {
                srcToken,
                srcDecimals,
                destToken,
                destDecimals,
                swapExchanges: [
                  {
                    exchange: 'balancerV2',
                    srcAmount: swap1SrcAmount,
                    destAmount: swap1DestAmount,
                    percent: swap1percent,
                    data: { poolId: '0xFirst' },
                    poolAddresses: ['0xFirst'],
                  },
                  {
                    exchange: 'balancerV2',
                    srcAmount: swap2SrcAmount,
                    destAmount: swap2DestAmount,
                    percent: swap2percent,
                    data: { poolId: '0xSecond-virtualBoostedPool' },
                    poolAddresses: ['0xSecond-virtualBoostedPool'],
                  },
                ],
              },
            ],
          },
        ],
        gasCostUSD: '0',
        gasCost: '0',
        others: [],
        side,
        tokenTransferProxy: '', // TokenTransferProxyAddress[this.network],
        contractAddress: '', // AugustusAddress[this.network],
      };
      const optimized = balancerV2Merge(unoptimizedRate);
      expect(optimized.bestRoute.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].srcToken).toEqual(srcToken);
      expect(optimized.bestRoute[0].swaps[0].srcDecimals).toEqual(srcDecimals);
      expect(optimized.bestRoute[0].swaps[0].destToken).toEqual(destToken);
      expect(optimized.bestRoute[0].swaps[0].destDecimals).toEqual(
        destDecimals,
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges.length).toEqual(1);
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].exchange).toEqual(
        'balancerV2',
      );
      expect(optimized.bestRoute[0].swaps[0].swapExchanges[0].percent).toEqual(
        100,
      );
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].srcAmount,
      ).toEqual(srcAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].destAmount,
      ).toEqual(destAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses,
      ).toEqual(['0xFirst', '0xSecond-virtualBoostedPool']);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps.length,
      ).toEqual(2);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].poolId,
      ).toEqual('0xFirst');
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[0].amount,
      ).toEqual(swap1SrcAmount);
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[1].poolId,
      ).toEqual('0xSecond-virtualBoostedPool');
      expect(
        optimized.bestRoute[0].swaps[0].swapExchanges[0].data.swaps[1].amount,
      ).toEqual(swap2SrcAmount);
    });
  });
});
