import {
  ContractPath,
  ContractAdapter,
  OptimalSwap,
  OptimalRoute,
  ContractMegaSwapPath,
  OptimalSwapExchange,
  Address,
  NumberAsString,
} from '../types';
import { SwapSide } from '../constants';
import { DexMap } from '../dex/idex';

// This class can be used commonly by all the router
// that will use the adapters.
export class PayloadEncoder {
  constructor(protected dexMap: DexMap) {}
  // Should have function for optimally choosing the Adapters
  getContractPaths(swaps: OptimalSwap[]): ContractPath[] {
    return swaps.map(s => {
      const adapters = this.getAdapters(s.src, s.dest, s.swapExchanges);
      const totalNetworkFee = adapters
        .reduce(
          (sum: bigint, a: ContractAdapter) => sum + BigInt(a.networkFee),
          BigInt(0),
        )
        .toString();
      return {
        to: s.dest,
        totalNetworkFee,
        adapters,
      };
    });
  }

  getMegaSwapPaths(routes: OptimalRoute[]): ContractMegaSwapPath[] {
    return routes.map(r => ({
      fromAmountPercent: (r.percent * 100).toFixed(0),
      path: this.getContractPaths(r.swaps),
    }));
  }

  getAdapters(
    src: Address,
    dest: Address,
    swapExchanges: OptimalSwapExchange[],
  ): ContractAdapter[] {
    const exchangeAdapterMap = this.getOptimalExchangeAdapterMap(swapExchanges);
    let adaptersMap: { [adapter: string]: ContractAdapter } = {};
    swapExchanges.forEach((se: OptimalSwapExchange) => {
      const [adapterAddress, index] =
        exchangeAdapterMap[se.exchange.toLowerCase()];
      if (!(adapterAddress in adaptersMap)) {
        adaptersMap[adapterAddress] = {
          adapter: adapterAddress,
          percent: '0',
          networkFee: '0',
          route: [],
        };
      }
      const adapterParam = this.dexMap[
        se.exchange.toLowerCase()
      ].getAdapterParam(
        src,
        dest,
        se.srcAmount,
        se.destAmount,
        se.data,
        SwapSide.SELL,
      );
      adaptersMap[adapterAddress].percent = (
        parseFloat(adaptersMap[adapterAddress].percent) +
        se.percent * 100
      ).toFixed(0);
      adaptersMap[adapterAddress].networkFee = (
        BigInt(adaptersMap[adapterAddress].networkFee) +
        BigInt(adapterParam.networkFee)
      ).toString();
      adaptersMap[adapterAddress].route.push({
        ...adapterParam,
        index,
        percent: (se.percent * 100).toFixed(0),
      });
    });
    return Object.values(adaptersMap);
  }

  getOptimalExchangeAdapterMap(swapExchanges: OptimalSwapExchange[]): {
    [exchange: string]: [Address, number];
  } {
    // TODO: implement the logic properly
    return {
      uniswapv2: ['0x0000000000000000000000000000000000000000', 0],
    };
  }
}
