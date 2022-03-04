import { UnoptimizedRate, OptimalSwap, Address } from '../../types';
import { isETHAddress } from '../../utils';
import { UniswapV2Config } from './config';
import { MDEXConfig } from './mdex';
import { BiSwapConfig } from './biswap';
import _ from 'lodash';

const AllUniswapForks = [
  ...Object.keys(UniswapV2Config),
  ...Object.keys(MDEXConfig),
  ...Object.keys(BiSwapConfig),
];

// TODO: use something similar for DODO as well
export function uniswapMerge(or: UnoptimizedRate): UnoptimizedRate {
  const fixRoute = (rawRate: OptimalSwap[]): OptimalSwap[] => {
    let lastExchange: false | OptimalSwap = false;
    let optimizedRate = new Array<OptimalSwap>();
    rawRate.forEach((s: OptimalSwap) => {
      // we only consider 100% swaps using uniswap
      // TODO: improve it to also consider partial
      // swap with equal volume.
      if (
        s.swapExchanges.length !== 1 ||
        AllUniswapForks.every(
          e => e.toLowerCase() !== s.swapExchanges[0].exchange.toLowerCase(),
        )
      ) {
        lastExchange = false;
        optimizedRate.push(s);
      } else if (
        lastExchange &&
        _.last(
          <Address[]>lastExchange.swapExchanges[0].data.path,
        )!.toLowerCase() === s.swapExchanges[0].data.path[0].toLowerCase()
      ) {
        lastExchange.swapExchanges[0].data.path.push(
          s.swapExchanges[0].data.path[1],
        );
        const currentName = lastExchange.swapExchanges[0].exchange;
        const newName = s.swapExchanges[0].exchange;
        lastExchange.swapExchanges[0].exchange =
          currentName === newName ? currentName : 'UniswapForkOptimized';
        lastExchange.swapExchanges[0].data.pools.push(
          s.swapExchanges[0].data.pools[0],
        );
        lastExchange.swapExchanges[0].poolAddresses!.push(
          s.swapExchanges[0].poolAddresses![0],
        );
        lastExchange.swapExchanges[0].data.gasUSD = (
          parseFloat(lastExchange.swapExchanges[0].data.gasUSD) +
          parseFloat(s.swapExchanges[0].data.gasUSD)
        ).toFixed(6);
        if (isETHAddress(s.destToken)) {
          lastExchange.swapExchanges[0].data.weth =
            s.swapExchanges[0].data.weth;
        }
        lastExchange.destToken = s.destToken;
        lastExchange.destDecimals = s.destDecimals;
        lastExchange.swapExchanges[0].destAmount =
          s.swapExchanges[0].destAmount;
      } else {
        lastExchange = _.cloneDeep(s);
        optimizedRate.push(lastExchange);
      }
    });
    return optimizedRate;
  };
  or.bestRoute = or.bestRoute.map(r => ({
    ...r,
    swaps: fixRoute(r.swaps),
  }));
  return or;
}
