import { UnoptimizedRate, OptimalSwapExchange } from '../../types';
import { BalancerSwapV2 } from './types';
import { SwapSide } from '../../constants';
import { BalancerConfig } from './config';

export function balancerV2Merge(or: UnoptimizedRate): UnoptimizedRate {
  const fixSwap = (
    rawSwap: OptimalSwapExchange<any>[],
    exchange: string,
    side: SwapSide,
  ): OptimalSwapExchange<any>[] => {
    const exchangeLower = exchange.toLowerCase();
    const newBalancer: OptimalSwapExchange<any> = {
      exchange,
      srcAmount: '0',
      destAmount: '0',
      percent: 0,
      poolAddresses: [],
      data: {
        swaps: new Array<BalancerSwapV2>(),
        gasUSD: '0',
      },
    };
    let optimizedSwap = new Array<OptimalSwapExchange<any>>();
    rawSwap.forEach((_s: OptimalSwapExchange<any>) => {
      if (_s.exchange.toLowerCase() === exchangeLower) {
        const s = _s;
        newBalancer.srcAmount = (
          BigInt(newBalancer.srcAmount) + BigInt(s.srcAmount)
        ).toString();

        newBalancer.destAmount = (
          BigInt(newBalancer.destAmount) + BigInt(s.destAmount)
        ).toString();

        newBalancer.percent += s.percent;
        newBalancer.data.exchangeProxy = s.data.exchangeProxy;
        newBalancer.data.gasUSD = (
          parseFloat(newBalancer.data.gasUSD) + parseFloat(s.data.gasUSD)
        ).toFixed(6);

        newBalancer.data.swaps.push({
          poolId: s.data.poolId,
          amount: side === SwapSide.SELL ? s.srcAmount : s.destAmount,
        });
        newBalancer.poolAddresses!.push(s.poolAddresses![0]);
      } else {
        optimizedSwap.push(_s);
      }
    });
    if (newBalancer.data!.swaps.length) optimizedSwap.push(newBalancer);
    return optimizedSwap;
  };

  or.bestRoute = or.bestRoute.map(r => ({
    ...r,
    swaps: r.swaps.map(s => {
      return {
        ...s,
        swapExchanges: Object.keys(BalancerConfig).reduce(
          (acc, exchange) => fixSwap(acc, exchange, or.side),
          s.swapExchanges,
        ),
      };
    }),
  }));
  return or;
}
