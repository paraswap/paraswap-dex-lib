import {
  ContractPath,
  ContractAdapter,
  OptimalSwap,
  OptimalRoute,
  ContractMegaSwapPath,
  OptimalSwapExchange,
  Address,
  NumberAsString,
  Adapters,
} from '../types';
import { SwapSide } from '../constants';
import { DexMap } from '../dex/idex';

// This class can be used commonly by all the router
// that will use the adapters.
export class PayloadEncoder {
  constructor(protected dexMap: DexMap, protected adapters: Adapters) {}
  // Should have function for optimally choosing the Adapters
  getContractPathsWithNetworkFee(swaps: OptimalSwap[]): { paths: ContractPath[], networkFee: bigint } {
    let totalNetworkFee = BigInt(0);
    const paths = swaps.map(s => {
      const adapters = this.getAdapters(s.src, s.dest, s.swapExchanges);
      const totalPathNetworkFee = adapters
        .reduce(
          (sum: bigint, a: ContractAdapter) => sum + BigInt(a.networkFee),
          BigInt(0),
        )
      totalNetworkFee += totalPathNetworkFee;
      return {
        to: s.dest,
        totalNetworkFee: totalPathNetworkFee.toString(),
        adapters,
      };
    });
    return { paths, networkFee: totalNetworkFee};
  }

  getMegaSwapPathsWithNetworkFee(routes: OptimalRoute[]): { megaSwapPaths: ContractMegaSwapPath[], networkFee: bigint } {
    let totalNetworkFee = BigInt(0);
    const megaSwapPaths = routes.map(r => {
      const { paths, networkFee } = this.getContractPathsWithNetworkFee(r.swaps);
      totalNetworkFee += networkFee;
      return {
        fromAmountPercent: (r.percent * 100).toFixed(0),
        path: paths,
      };
    });
    return { megaSwapPaths, networkFee: totalNetworkFee};
  }

  getAdapters(
    src: Address,
    dest: Address,
    swapExchanges: OptimalSwapExchange<any>[],
  ): ContractAdapter[] {
    const exchangeAdapterMap = this.getOptimalExchangeAdapterMap(swapExchanges);
    let adaptersMap: { [adapter: string]: ContractAdapter } = {};
    swapExchanges.forEach((se: OptimalSwapExchange<any>) => {
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

  // Find the best adapter, assign exhanges that use best adapter, filter out the   
  // exchanges that were not assigned with the best adapter, recursively call 
  // getOptimalExchangeAdapterMap until swapExchanges is empty
  getOptimalExchangeAdapterMap(swapExchanges: OptimalSwapExchange<any>[]): {
    [exchange: string]: [Address, number];
  } {
    if (!swapExchanges.length) return {};

    const adapterPoints: {[adapter: string]: number} = {};
    swapExchanges.forEach(
      se => 
        this.adapters[se.exchange.toLowerCase()].forEach(
          a => {
            const adapter = a.adapter.toLowerCase();
            if (!(adapter in adapterPoints))
              adapterPoints[adapter] = 0;
            adapterPoints[adapter] += 1;
          }
         )
    );

    const bestAdapter = Object.keys(adapterPoints).reduce((a, b) => adapterPoints[a] > adapterPoints[b] ? a : b);
    // TODO: implement the logic properly
    let optimalAdapters: {
      [exchange: string]: [Address, number];
    } = {};
    const leftSwapExchange: OptimalSwapExchange<any>[] = []; 
    
    swapExchanges.forEach(se => {
      const exchangeKey = se.exchange.toLowerCase();
      const adapterConfig = this.adapters[exchangeKey].find(({adapter}) => adapter.toLowerCase() === bestAdapter);
      if (adapterConfig) {
        optimalAdapters[exchangeKey] = [adapterConfig.adapter, adapterConfig.index];
      } else {
        leftSwapExchange.push(se);
      }
    });
    return {...optimalAdapters, ...this.getOptimalExchangeAdapterMap(leftSwapExchange)};
  }
}
