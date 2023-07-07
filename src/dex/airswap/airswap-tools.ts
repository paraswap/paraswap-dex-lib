import { providers } from 'ethers';
import { Token } from '../../types';
import { Registry, Server } from '@airswap/libraries';
import { PriceLevel, QuoteResponse } from './types';
import axios, { Method } from 'axios';
import BigNumber from 'bignumber.js';
import { getBigNumberPow } from '../../bignumber-constants';
import { SwapSide } from '@paraswap/core';
import { FullOrderERC20 } from '@airswap/types';
// import { Protocols } from '@airswap/constants';

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
    const servers = (await connectToServers(urls, chainId)).filter(s =>
      s.locator.includes('altono'),
    );
    console.log('server:', servers);
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
    // const urls = await RegistryV4.getServerURLs(provider, chainId, Protocols.PricingERC20, baseToken, quoteToken);
    const urls = await Registry.getServerURLs(
      provider,
      chainId,
      baseToken,
      quoteToken,
    );
    return Promise.resolve(
      urls.filter(url => url.includes('altono') && !isWebsocket(url)),
    );
  } catch (err) {
    console.error(err);
    return Promise.resolve([]);
  }
}

const isWebsocket = (url: string) => url.includes('wss');

const rejectAfterDelay = (ms: number) =>
  new Promise((_, reject) => {
    setTimeout(reject, ms, new Error('timeout'));
  });
export const fulfilledWithinTimeout = async <T>(
  promises: Promise<T>[],
  timeout: number,
): Promise<T[]> => {
  promises = Array.isArray(promises) ? promises : [...promises];
  const availblesMakers = (await Promise.allSettled(
    promises.map(promise => Promise.race([promise, rejectAfterDelay(timeout)])),
  )) as PromiseFulfilledResult<T>[];
  const fulfilled = availblesMakers.filter(
    ({ status }) => status === 'fulfilled',
  );
  return fulfilled.map(promise => promise.value);
};

async function connectToServers(
  serversUrl: string[],
  chainId: number,
): Promise<Array<Server>> {
  const promises = serversUrl.map(url => Server.at(url, { chainId }));
  const servers = await fulfilledWithinTimeout<Server>(promises, 3000);
  return servers;
}

export async function makeRFQ(
  maker: Server,
  senderWallet: string,
  srcToken: Token,
  destToken: Token,
  amount: string,
): Promise<QuoteResponse> {
  // senderWallet = '0xe4064498e11797e377a170b3d5974d38861fdabf'
  // senderWallet = '0x4F67220b0329312c24ab97086011e7503aE955FE'
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
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    data: data,
  };
  console.log('swapSide', swapSide === SwapSide.SELL ? 'SELL' : 'BUY');
  console.log('data', config);

  try {
    const response = await axios.request(config);
    const result =
      swapSide === SwapSide.SELL
        ? mapMakerSELLResponse(response.data.result[0].bid)
        : mapMakerBUYResponse(response.data.result[0].ask);
    console.log('getting answer from', url);
    return result;
  } catch (err) {
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
  return {
    unitPrice: BigInt(unitPrice.toFixed(0)),
    prices: prices.map(price => BigInt(price.toFixed(0))),
  };
}
