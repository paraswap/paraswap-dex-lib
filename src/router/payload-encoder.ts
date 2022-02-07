import {
  ContractRoute,
  ContractPath,
  ContractAdapter,
  OptimalSwap,
  OptimalRoute,
  ContractMegaSwapPath,
  OptimalSwapExchange,
  Address,
  Adapters,
} from '../types';
import { SwapSide } from '../constants';
import { DexAdapterService } from '../dex';
import { convertToBasisPoints } from '../utils';

export function encodeFeePercent(
  partnerFeePercent: string,
  positiveSlippageToUser: boolean,
) {
  let fee = BigInt(partnerFeePercent);
  if (fee > 10000) throw new Error('fee bps should be less than 10000');

  // Set 14th bit if positiveSlippageToUser is true
  if (positiveSlippageToUser) fee |= BigInt(1) << BigInt(14);

  // Bits 248 - 255 is used for version;
  // Set version = 1;
  fee |= BigInt(1) << BigInt(248);

  return fee.toString();
}

// This class can be used commonly by all the router
// that will use the adapters.
export class PayloadEncoder {
  constructor(
    protected dexAdapterService: DexAdapterService,
    protected adapters: Adapters,
  ) {}
  // Should have function for optimally choosing the Adapters
  getContractPathsWithNetworkFee(swaps: OptimalSwap[]): {
    paths: ContractPath[];
    networkFee: bigint;
  } {
    let totalNetworkFee = BigInt(0);
    const paths = swaps.map(s => {
      const adapters = this.getAdapters(
        s.srcToken,
        s.destToken,
        s.swapExchanges,
      );
      const totalPathNetworkFee = adapters.reduce(
        (sum: bigint, a: ContractAdapter) => sum + BigInt(a.networkFee),
        BigInt(0),
      );
      totalNetworkFee += totalPathNetworkFee;
      return {
        to: s.destToken,
        totalNetworkFee: totalPathNetworkFee.toString(),
        adapters,
      };
    });
    return { paths, networkFee: totalNetworkFee };
  }

  getMegaSwapPathsWithNetworkFee(routes: OptimalRoute[]): {
    megaSwapPaths: ContractMegaSwapPath[];
    networkFee: bigint;
  } {
    let totalNetworkFee = BigInt(0);
    const megaSwapPaths = routes.map(r => {
      const { paths, networkFee } = this.getContractPathsWithNetworkFee(
        r.swaps,
      );
      totalNetworkFee += networkFee;
      return {
        fromAmountPercent: (r.percent * 100).toFixed(0),
        path: paths,
      };
    });
    return { megaSwapPaths, networkFee: totalNetworkFee };
  }

  getAdapterAndRouteForBuy(
    srcToken: Address,
    destToken: Address,
    swapExchanges: OptimalSwapExchange<any>[],
    maxAmount: string,
    totalSrcAmount: string,
  ): { adapter: Address; route: ContractRoute[]; networkFee: bigint } {
    const exchangeAdapterMap = this.getOptimalExchangeAdapterMap(
      swapExchanges,
      SwapSide.BUY,
    );
    let adapter = '';
    let networkFee = BigInt(0);
    let route: ContractRoute[] = [];
    swapExchanges.forEach((se: OptimalSwapExchange<any>) => {
      const [adapterAddress, index] =
        exchangeAdapterMap[se.exchange.toLowerCase()];
      adapter = adapterAddress; //Will be the same for all exchanges for BUY
      const adapterParam = this.dexAdapterService
        .getDexByKey(se.exchange)
        .getAdapterParam(
          srcToken,
          destToken,
          (
            (BigInt(se.srcAmount) * BigInt(maxAmount)) /
            BigInt(totalSrcAmount)
          ).toString(),
          se.destAmount,
          se.data,
          SwapSide.BUY,
        );
      networkFee += BigInt(adapterParam.networkFee);
      route.push({
        ...adapterParam,
        index,
        percent: (se.percent * 100).toFixed(0),
      });
    });
    return { adapter, route, networkFee };
  }

  getAdapters(
    srcToken: Address,
    destToken: Address,
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
      const adapterParam = this.dexAdapterService
        .getDexByKey(se.exchange)
        .getAdapterParam(
          srcToken,
          destToken,
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
    return Object.values(adaptersMap).map(ca => {
      const rawPercent = ca.route.map(r => Number(r.percent));
      const fixedPercent = convertToBasisPoints(rawPercent).map(p =>
        p.toFixed(),
      );
      const routeWithFixedPercent = ca.route.map((r, i) => ({
        ...r,
        percent: fixedPercent[i],
      }));
      return { ...ca, route: routeWithFixedPercent };
    });
  }

  // Find the best adapter, assign exhanges that use best adapter, filter out the
  // exchanges that were not assigned with the best adapter, recursively call
  // getOptimalExchangeAdapterMap until swapExchanges is empty (except for BUY)
  getOptimalExchangeAdapterMap(
    swapExchanges: OptimalSwapExchange<any>[],
    side: SwapSide = SwapSide.SELL,
  ): {
    [exchange: string]: [Address, number];
  } {
    if (!swapExchanges.length) return {};

    const adapterPoints: { [adapter: string]: number } = {};
    swapExchanges.forEach(se => {
      const adapters = this.adapters[se.exchange.toLowerCase()];
      if (!adapters.length)
        throw new Error(`No adapter found for ${se.exchange}`);
      adapters.forEach(a => {
        const adapter = a.adapter.toLowerCase();
        if (!(adapter in adapterPoints)) adapterPoints[adapter] = 0;
        adapterPoints[adapter] += 1;
      });
    });

    const bestAdapter = Object.keys(adapterPoints).reduce((a, b) =>
      adapterPoints[a] > adapterPoints[b] ? a : b,
    );
    // TODO: implement the logic properly
    let optimalAdapters: {
      [exchange: string]: [Address, number];
    } = {};
    const leftSwapExchange: OptimalSwapExchange<any>[] = [];

    swapExchanges.forEach(se => {
      const exchangeKey = se.exchange.toLowerCase();
      const adapterConfig = this.adapters[exchangeKey].find(
        ({ adapter }) => adapter.toLowerCase() === bestAdapter,
      );
      if (adapterConfig) {
        optimalAdapters[exchangeKey] = [
          adapterConfig.adapter,
          adapterConfig.index,
        ];
      } else {
        if (side === SwapSide.BUY)
          throw new Error('No adapter found containing all exchanges');
        leftSwapExchange.push(se);
      }
    });
    return {
      ...optimalAdapters,
      ...this.getOptimalExchangeAdapterMap(leftSwapExchange),
    };
  }
}
