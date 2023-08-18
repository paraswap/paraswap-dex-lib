import _ from 'lodash';
import { UnoptimizedRate } from '../../types';
import { SwapSide } from '../../constants';
import { BalancerConfig } from './config';
import { OptimalSwap } from '@paraswap/core';

export function balancerV2Merge(or: UnoptimizedRate): UnoptimizedRate {
  const balancerForksList = Object.keys(BalancerConfig).map(b =>
    b.toLowerCase(),
  );
  const fixSwap = (rawRate: OptimalSwap[], side: SwapSide): OptimalSwap[] => {
    let lastExchange: false | OptimalSwap = false;
    let optimizedRate = new Array<OptimalSwap>();
    rawRate.forEach((s: OptimalSwap) => {
      if (
        s.swapExchanges.length !== 1 ||
        !balancerForksList.includes(s.swapExchanges[0].exchange.toLowerCase())
      ) {
        lastExchange = false;
        optimizedRate.push(s);
      } else if (
        lastExchange &&
        lastExchange.swapExchanges[0].exchange.toLowerCase() ===
          s.swapExchanges[0].exchange.toLowerCase() &&
        _.last(
          <any[]>lastExchange.swapExchanges[0].data.swaps,
        )!.tokenOut.toLowerCase() ===
          s.swapExchanges[0].data.tokenIn.toLowerCase()
      ) {
        const [lastExchangeSwap] = lastExchange.swapExchanges;
        const [currentSwap] = s.swapExchanges;
        lastExchangeSwap.srcAmount = (
          BigInt(lastExchangeSwap.srcAmount) + BigInt(currentSwap.srcAmount)
        ).toString();

        lastExchangeSwap.destAmount = (
          BigInt(lastExchangeSwap.destAmount) + BigInt(currentSwap.destAmount)
        ).toString();

        lastExchangeSwap.percent += currentSwap.percent;
        lastExchangeSwap.data.gasUSD = (
          parseFloat(lastExchangeSwap.data.gasUSD) +
          parseFloat(currentSwap.data.gasUSD)
        ).toFixed(6);

        lastExchangeSwap.data.swaps.push({
          poolId: currentSwap.data.poolId,
          amount:
            side === SwapSide.SELL
              ? currentSwap.srcAmount
              : currentSwap.destAmount,
          tokenIn: currentSwap.data.tokenIn,
          tokenOut: currentSwap.data.tokenOut,
        });
        lastExchangeSwap.poolAddresses!.push(currentSwap.poolAddresses![0]);
      } else {
        lastExchange = _.cloneDeep(s);
        lastExchange.swapExchanges[0].data = {};
        lastExchange.swapExchanges[0].data.gasUSD =
          s.swapExchanges[0].data.gasUSD;
        lastExchange.swapExchanges[0].data.swaps = [
          {
            poolId: s.swapExchanges[0].data.poolId,
            amount:
              side === SwapSide.SELL
                ? s.swapExchanges[0].srcAmount
                : s.swapExchanges[0].destAmount,
            tokenIn: s.swapExchanges[0].data.tokenIn,
            tokenOut: s.swapExchanges[0].data.tokenOut,
          },
        ];
        optimizedRate.push(lastExchange);
      }
    });
    return optimizedRate;
  };

  or.bestRoute = or.bestRoute.map(r => ({
    ...r,
    swaps: fixSwap(r.swaps, or.side),
  }));
  return or;
}
