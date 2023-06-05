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

const OneShift14 = 1n << 14n;
const OneShift15 = 1n << 15n;
const OneShift16 = 1n << 16n;
const OneShift248 = 1n << 248n;

// Referrer gets 25% of positive slippage
// Set 16th bit to indicate referral program
const REFERRER_FEE = 2500n | OneShift14 | OneShift16 | OneShift248;

const HALF_SPLIT = '5000';

export function encodeFeePercent(
  partnerFeePercent: string,
  positiveSlippageToUser: boolean,
  side: SwapSide,
) {
  const isNoFeeAndPositiveSlippageToPartner =
    positiveSlippageToUser === false && BigInt(partnerFeePercent) === 0n;

  let fee = isNoFeeAndPositiveSlippageToPartner
    ? BigInt(HALF_SPLIT)
    : BigInt(partnerFeePercent);

  if (fee > 10000) throw new Error('fee bps should be less than 10000');

  // Set 16th bit as referrer to split positive slippage for partner and protocol
  if (isNoFeeAndPositiveSlippageToPartner) fee |= OneShift16;

  // Set 14th bit if positiveSlippageToUser is true
  if (positiveSlippageToUser) fee |= OneShift14;

  // Set 15th bit to take fee from srcToken
  if (side === SwapSide.BUY) fee |= OneShift15;

  // Bits 248 - 255 is used for version;
  // Set version = 1;
  fee |= OneShift248;

  return fee.toString();
}

export function encodeFeePercentForReferrer(side: SwapSide) {
  let fee = REFERRER_FEE;

  // Set 15th bit to take fee from srcToken
  if (side === SwapSide.BUY) fee |= OneShift15;

  return fee.toString();
}

// This class can be used commonly by all the router
// that will use the adapters.
export class PayloadEncoder {
  constructor(protected dexAdapterService: DexAdapterService) {}
  // Should have function for optimally choosing the Adapters
  getContractPathsWithNetworkFee(swaps: OptimalSwap[]): {
    paths: ContractPath[];
    networkFee: bigint;
  } {
    let totalNetworkFee = 0n;
    const paths = swaps.map(s => {
      const adapters = this.getAdapters(
        s.srcToken,
        s.destToken,
        s.swapExchanges,
      );
      const totalPathNetworkFee = adapters.reduce(
        (sum: bigint, a: ContractAdapter) => sum + BigInt(a.networkFee),
        0n,
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
    let totalNetworkFee = 0n;
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
    let networkFee = 0n;
    let route: ContractRoute[] = [];
    swapExchanges.forEach((se: OptimalSwapExchange<any>) => {
      const [adapterAddress, index] =
        exchangeAdapterMap[se.exchange.toLowerCase()];
      adapter = adapterAddress; //Will be the same for all exchanges for BUY
      const adapterParam = this.dexAdapterService
        .getTxBuilderDexByKey(se.exchange)
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
        .getTxBuilderDexByKey(se.exchange)
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

  // Find the best adapter, assign exchanges that use best adapter, filter out the
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
      const adapters = this.dexAdapterService.getAdapter(se.exchange, side);
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
      const adapterConfig = this.dexAdapterService
        .getAdapter(se.exchange, side)
        .find(({ adapter }) => adapter.toLowerCase() === bestAdapter);
      if (adapterConfig) {
        optimalAdapters[se.exchange.toLowerCase()] = [
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
