import { Contract, ethers, providers } from 'ethers';
import { Token } from '../../types';
import { Registry, Server, SwapERC20 } from '@airswap/libraries';
import { PriceLevel, QuoteResponse } from './types';
import axios, { Method } from 'axios';
import BigNumber from 'bignumber.js';
import { BN_0, getBigNumberPow } from '../../bignumber-constants';
import { SwapSide } from '@paraswap/core';
import { Protocols } from "@airswap/constants";

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
      chainId
    );
    const servers = await getServers(urls);
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
  console.log(Registry.addresses)
  const urls = await Registry.getServerURLs(provider, 5, Protocols.PricingERC20);
  return Promise.resolve(urls);
}

async function getServers(serversUrl: string[]): Promise<Array<Server>> {
  const serverPromises = (await Promise.allSettled(
    serversUrl.map(url => Server.at(url)),
  )) as PromiseFulfilledResult<Server>[];
  return serverPromises
    . filter(promise => promise.status === 'fulfilled')
    .map((promise: PromiseFulfilledResult<Server>) => promise.value);
}

export async function makeRFQ(
  maker: Server,
  senderWallet: string,
  srcToken: Token,
  destToken: Token,
  amount: string,
): Promise<QuoteResponse> {
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
}

export async function getPricingErc20( // https://kehr54rr.altono.xyz/airswap/mainet/
  url: string,
  srcToken: Token,
  destToken: Token,
): Promise<PriceLevel[]> {
  let data = JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'getPricingERC20',
    params: [
      {
        baseToken: srcToken.symbol,//'USDC',
        quoteToken: destToken.symbol,//'USDT',
      },
    ],
  });
  console.log('data', data);
  let config = {
    method: 'POST' as Method,
    maxBodyLength: Infinity,
    url: url,
    headers: {
      'Content-Type': 'application/json',
    },
    data: data,
  };

  try {
    const response = await axios.request(config);
    return mapMakerResponse(response.data.result[0].bid);
  } catch (err) {
    console.log('response', err);
    return [];
  }
}

export function mapMakerResponse(bid: number[][]) {
  return bid.map((bid: number[]) => {
    const [threshold, price] = bid;
    return { level: ""+threshold, price: ""+(price*(1-0.06)) };
  })
}

export function computePricesFromLevels(
  amounts: BigNumber[],
  levels: PriceLevel[],
  srcToken: Token,
  destToken: Token,
  side: SwapSide,
): bigint[] {
  if (levels.length > 0) {
    const firstLevel = levels[0];
    if (new BigNumber(firstLevel.level).gt(0)) {
      // Add zero level for price computation
      levels.unshift({ level: '0', price: firstLevel.price });
    }
  }

  const outputs = new Array<BigNumber>(amounts.length).fill(BN_0);
  for (const [index, amount] of amounts.entries()) {
    if (amount.isZero()) {
      outputs[index] = BN_0;
    } else {
      const output =
        side === SwapSide.SELL
          ? computeLevelsQuote(levels, amount, undefined)
          : computeLevelsQuote(levels, undefined, amount);

      if (output === undefined) {
        // If current amount was unfillable, then bigger amounts are unfillable as well
        break;
      } else {
        outputs[index] = output;
      }
    }
  }

  const decimals =
    side === SwapSide.SELL ? destToken.decimals : srcToken.decimals;

  return outputs.map(output =>
    BigInt(output.multipliedBy(getBigNumberPow(decimals)).toFixed(0)),
  );
}

function levelsToLevelsBigNumber(
  priceLevels: PriceLevel[],
): { level: BigNumber; price: BigNumber }[] {
  return priceLevels.map(l => ({
    level: new BigNumber(l.level),
    price: new BigNumber(l.price),
  }));
}
function computeLevelsQuote(
  priceLevels: PriceLevel[],
  baseAmount?: BigNumber,
  quoteAmount?: BigNumber,
): BigNumber | undefined {
  if (priceLevels.length === 0) {
    return undefined;
  }
  const levels = levelsToLevelsBigNumber(priceLevels);

  const quote = {
    baseAmount: levels[0].level,
    quoteAmount: levels[0].level.multipliedBy(levels[0].price),
  };
  if (
    (baseAmount && baseAmount.lt(quote.baseAmount)) ||
    (quoteAmount && quoteAmount.lt(quote.quoteAmount))
  ) {
    return undefined;
  }

  for (let i = 1; i < levels.length; i++) {
    const nextLevel = levels[i];
    const nextLevelDepth = nextLevel.level.minus(levels[i - 1]!.level);
    const nextLevelQuote = quote.quoteAmount.plus(
      nextLevelDepth.multipliedBy(nextLevel.price),
    );
    if (baseAmount && baseAmount.lte(nextLevel.level)) {
      const baseDifference = baseAmount.minus(quote.baseAmount);
      const quoteAmount = quote.quoteAmount.plus(
        baseDifference.multipliedBy(nextLevel.price),
      );
      return quoteAmount;
    } else if (quoteAmount && quoteAmount.lte(nextLevelQuote)) {
      const quoteDifference = quoteAmount.minus(quote.quoteAmount);
      const baseAmount = quote.baseAmount.plus(
        quoteDifference.dividedBy(nextLevel.price),
      );
      return baseAmount;
    }

    quote.baseAmount = nextLevel.level;
    quote.quoteAmount = nextLevelQuote;
  }

  return undefined;
}
