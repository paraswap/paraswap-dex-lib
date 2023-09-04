import { UnoptimizedRate, OptimalSwapExchange } from '../../types';
import { BalancerSwapV2 } from './types';
import { SwapSide } from '../../constants';
import { BalancerConfig } from './config';

export const AllBalancerV2Forks = Object.keys(BalancerConfig);

export function balancerV2Merge(or: UnoptimizedRate): UnoptimizedRate {
  const fixSwap = (
    rawSwap: OptimalSwapExchange<any>[],
    accumulatedBalancers: { [key: string]: OptimalSwapExchange<any> },
    side: SwapSide,
  ): OptimalSwapExchange<any>[] => {
    let optimizedSwap = new Array<OptimalSwapExchange<any>>();
    const newBalancers: { [key: string]: OptimalSwapExchange<any> } = {};
    rawSwap.forEach((s: OptimalSwapExchange<any>) => {
      const exchangeKey = s.exchange.toLowerCase();
      if (AllBalancerV2Forks.some(d => d.toLowerCase() === exchangeKey)) {
        if (!(exchangeKey in accumulatedBalancers)) {
          newBalancers[exchangeKey] = {
            exchange: s.exchange,
            srcAmount: '0',
            destAmount: '0',
            percent: 0,
            poolAddresses: [],
            data: {
              swaps: new Array<BalancerSwapV2>(),
              gasUSD: '0',
            },
          };
          accumulatedBalancers[exchangeKey] = newBalancers[exchangeKey];
        }
        accumulatedBalancers[exchangeKey].srcAmount = (
          BigInt(accumulatedBalancers[exchangeKey].srcAmount) +
          BigInt(s.srcAmount)
        ).toString();

        accumulatedBalancers[exchangeKey].destAmount = (
          BigInt(accumulatedBalancers[exchangeKey].destAmount) +
          BigInt(s.destAmount)
        ).toString();

        accumulatedBalancers[exchangeKey].percent += s.percent;
        accumulatedBalancers[exchangeKey].data.exchangeProxy =
          s.data.exchangeProxy;
        accumulatedBalancers[exchangeKey].data.gasUSD = (
          parseFloat(accumulatedBalancers[exchangeKey].data.gasUSD) +
          parseFloat(s.data.gasUSD)
        ).toFixed(6);

        accumulatedBalancers[exchangeKey].data.swaps.push({
          poolId: s.data.poolId,
          amount: side === SwapSide.SELL ? s.srcAmount : s.destAmount,
        });
        accumulatedBalancers[exchangeKey].poolAddresses!.push(
          s.poolAddresses![0],
        );
      } else {
        optimizedSwap.push(s);
      }
    });
    optimizedSwap = optimizedSwap.concat(Object.values(newBalancers));
    return optimizedSwap;
  };

  or.bestRoute = or.bestRoute.map(r => {
    const accumulatedBalancers: {
      [key: string]: OptimalSwapExchange<any>;
    } = {};
    return {
      ...r,
      swaps: r.swaps.map(s => ({
        ...s,
        swapExchanges: fixSwap(s.swapExchanges, accumulatedBalancers, or.side),
      })),
    };
  });
  return or;
}
