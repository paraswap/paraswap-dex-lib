import { providers } from 'ethers';
import { Token } from '../../types';
import { Registry, Server } from '@airswap/libraries';
import { PriceLevel, QuoteResponse } from './types';
import axios, { Method } from 'axios';
import BigNumber from 'bignumber.js';
import { getBigNumberPow } from '../../bignumber-constants';
import { SwapSide } from '@paraswap/core';
import { FullOrderERC20 } from '@airswap/types';
import { Protocols } from '@airswap/constants';

export async function getAvailableMakersForRFQ(
  provider: providers.Provider,
  from: Token,
  to: Token,
  chainId: number,
): Promise<Server[]> {
  try {
    const urls = await getServersUrl(
      from.address,
      to.address,
      provider,
      chainId,
    );
    const servers = await getServers(urls, chainId);
    return Promise.resolve(servers);
  } catch (err) {
    return Promise.resolve([]);
  }
}

export async function getServersUrl(
  quoteToken: string,
  baseToken: string,
  provider: providers.Provider,
  chainId: number,
) {
  try {
    const urls = await Registry.getServerURLs(
      provider,
      chainId,
      baseToken,
      quoteToken,
    );
    return Promise.resolve(urls);
  } catch (err) {
    console.error(err);
    return Promise.resolve([]);
  }
}

async function getServers(
  serversUrl: string[],
  chainId: number,
): Promise<Array<Server>> {
  const serverPromises = (await Promise.allSettled(
    serversUrl.map(url => Server.at(url, { chainId })),
  )) as PromiseFulfilledResult<Server>[];
  return serverPromises
    .filter(promise => promise.status === 'fulfilled')
    .map((promise: PromiseFulfilledResult<Server>) => promise.value);
}

export async function makeRFQ(
  maker: Server,
  senderWallet: string,
  srcToken: Token,
  destToken: Token,
  amount: string,
): Promise<QuoteResponse> {
  try {
    console.log(
      'getSignerSideOrderERC20',
      maker.locator,
      amount.toString(),
      destToken.address,
      srcToken.address,
      senderWallet,
    );
    const response = await maker.getSignerSideOrderERC20(
      amount.toString(),
      destToken.address,
      srcToken.address,
      senderWallet,
    );
    console.log('[AIRSWAP]', 'getTx', {
      //@ts-ignore
      swapContract: maker.swapContract,
      senderWallet,
      maker: maker.locator,
      signedOrder: response,
    });
    return Promise.resolve({ maker: maker.locator, signedOrder: response });
  } catch (e) {
    console.error(e);
    return Promise.resolve({
      maker: maker.locator,
      signedOrder: {} as FullOrderERC20,
    });
  }
}

export async function getPricingErc20(
  url: string,
  srcToken: Token,
  destToken: Token,
  swapSide: SwapSide,
): Promise<PriceLevel[]> {
  let data = JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'getPricingERC20',
    params: [
      {
        baseToken: srcToken.symbol,
        quoteToken: destToken.symbol,
      },
    ],
  });
  let config = {
    method: 'POST' as Method,
    maxBodyLength: Infinity,
    url: 'https://kehr54rr.altono.xyz/airswap/polygon/',
    headers: {
      'Content-Type': 'application/json',
    },
    data: data,
  };
  console.log('swapSide', swapSide === SwapSide.SELL ? 'SELL' : 'BUY');
  console.log('data', config);

  try {
    const response = await axios.request(config);
    return swapSide === SwapSide.SELL
      ? mapMakerSELLResponse(response.data.result[0].bid)
      : mapMakerBUYResponse(response.data.result[0].ask);
  } catch (err) {
    console.log('response', err);
    return [];
  }
}

export function mapMakerSELLResponse(bid: number[][]) {
  return bid.map((bid: number[]) => {
    const [threshold, price] = bid;
    return { threshold, price };
  });
}

export function mapMakerBUYResponse(ask: number[][]) {
  return ask.map((ask: number[]) => {
    const [threshold, price] = ask;
    return { threshold, price };
  });
}

export function priceFromThreshold(
  amounts: BigNumber[],
  thresholds: PriceLevel[],
  srcToken: Token,
  destToken: Token,
  side: SwapSide,
): { unitPrice: bigint; prices: bigint[] } {
  const unitPrice = new BigNumber(
    thresholds.find(({ threshold }) => threshold >= 1)?.price || 0,
  );
  const prices = [];
  let indexAmount = 0;
  while (indexAmount < amounts.length) {
    const amount = amounts[indexAmount];
    const splittedThresholds = thresholds.filter(threshold =>
      new BigNumber(threshold.threshold).isLessThanOrEqualTo(amount),
    );
    splittedThresholds.sort((a, b) => a.threshold - b.threshold);

    let index = 0;
    let remaining: BigNumber = amount;
    let totalPriceForAmount = new BigNumber(0);
    while (
      index < splittedThresholds.length &&
      remaining.isGreaterThan(new BigNumber(0))
    ) {
      const currentThreshold = new BigNumber(
        splittedThresholds[index].threshold,
      );
      if (currentThreshold.isLessThan(remaining)) {
        totalPriceForAmount = totalPriceForAmount.plus(
          currentThreshold.multipliedBy(splittedThresholds[index].price),
        );
        remaining = remaining.minus(currentThreshold);
      } else {
        totalPriceForAmount = totalPriceForAmount.plus(
          remaining.multipliedBy(splittedThresholds[index].price),
        );
        remaining = remaining.minus(remaining);
      }
      index++;
    }
    if (
      splittedThresholds.length > 0 &&
      remaining.isGreaterThan(new BigNumber(0))
    ) {
      if (index == splittedThresholds.length) index--;
      totalPriceForAmount = totalPriceForAmount.plus(
        remaining.multipliedBy(splittedThresholds[index].price),
      );
      remaining = remaining.minus(remaining);
    }
    prices.push(totalPriceForAmount);
    indexAmount++;
  }

  const decimals =
    side === SwapSide.SELL ? destToken.decimals : srcToken.decimals;
  const exp = getBigNumberPow(decimals);

  return {
    unitPrice: BigInt(unitPrice.toFixed(0)),
    prices: prices.map(price => BigInt(price.toFixed(0))),
  };
}
