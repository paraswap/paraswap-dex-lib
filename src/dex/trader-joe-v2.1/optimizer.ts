import { Address, OptimalSwap, UnoptimizedRate } from '../../types';
import _ from 'lodash';

// We support multihop for TraderJoeV2.1 and TraderJoeV2.2
const TraderJoeV2Forks = ['TraderJoeV2.1', 'TraderJoeV2.2'].map(dexName =>
  dexName.toLowerCase(),
);

export function traderJoeMerge(or: UnoptimizedRate): UnoptimizedRate {
  const fixRoute = (rawRate: OptimalSwap[]): OptimalSwap[] => {
    let lastExchange: false | OptimalSwap = false;
    let optimizedRate = new Array<OptimalSwap>();

    rawRate.forEach((s: OptimalSwap) => {
      if (
        s.swapExchanges.length !== 1 ||
        !TraderJoeV2Forks.includes(s.swapExchanges[0].exchange.toLowerCase())
      ) {
        lastExchange = false;
        optimizedRate.push(s);
      } else if (
        lastExchange &&
        _.last(
          <Address[]>lastExchange.swapExchanges[0].data.tokenPath,
        )!.toLowerCase() === s.swapExchanges[0].data.tokenPath[0].toLowerCase()
      ) {
        lastExchange.swapExchanges[0].data.tokenPath.push(
          s.swapExchanges[0].data.tokenPath[1],
        );
        lastExchange.swapExchanges[0].data.binSteps.push(
          s.swapExchanges[0].data.binSteps[0],
        );
        lastExchange.swapExchanges[0].data.versions.push(
          s.swapExchanges[0].data.versions[0],
        );
        lastExchange.swapExchanges[0].poolAddresses!.push(
          s.swapExchanges[0].poolAddresses![0],
        );
        lastExchange.swapExchanges[0].data.gasUSD = (
          parseFloat(lastExchange.swapExchanges[0].data.gasUSD) +
          parseFloat(s.swapExchanges[0].data.gasUSD)
        ).toFixed(6);

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
