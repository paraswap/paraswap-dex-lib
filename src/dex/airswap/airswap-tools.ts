import { Contract, ethers, providers } from 'ethers';
import { Token } from '../../types';
import { Server } from '@airswap/libraries';
import { PriceLevel, QuoteResponse } from './types';
import axios, { Method } from 'axios';
import BigNumber from 'bignumber.js';
import { BN_0, getBigNumberPow } from '../../bignumber-constants';
import { SwapSide } from '@paraswap/core';
import { url } from 'inspector';
import { promises } from 'dns';
import { FullOrderERC20 } from '@airswap/types';
import { cp } from 'fs';

const makerRegistry = [
  {
    inputs: [
      {
        internalType: 'contract IERC20',
        name: '_stakingToken',
        type: 'address',
      },
      { internalType: 'uint256', name: '_obligationCost', type: 'uint256' },
      { internalType: 'uint256', name: '_tokenCost', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address[]',
        name: 'tokens',
        type: 'address[]',
      },
    ],
    name: 'AddTokens',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'FullUnstake',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'InitialStake',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address[]',
        name: 'tokens',
        type: 'address[]',
      },
    ],
    name: 'RemoveTokens',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      { indexed: false, internalType: 'string', name: 'url', type: 'string' },
    ],
    name: 'SetURL',
    type: 'event',
  },
  {
    inputs: [{ internalType: 'address[]', name: 'tokens', type: 'address[]' }],
    name: 'addTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'staker', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'getStakersForToken',
    outputs: [
      { internalType: 'address[]', name: 'stakers', type: 'address[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'staker', type: 'address' }],
    name: 'getSupportedTokens',
    outputs: [
      { internalType: 'address[]', name: 'tokenList', type: 'address[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address[]', name: 'stakers', type: 'address[]' }],
    name: 'getURLsForStakers',
    outputs: [{ internalType: 'string[]', name: 'urls', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'getURLsForToken',
    outputs: [{ internalType: 'string[]', name: 'urls', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'obligationCost',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'removeAllTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address[]', name: 'tokens', type: 'address[]' }],
    name: 'removeTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: '_url', type: 'string' }],
    name: 'setURL',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'stakerURLs',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'stakingToken',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'staker', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'supportsToken',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenCost',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export async function getAvailableMakersForRFQ(
  provider: providers.Provider,
  from: Token,
  to: Token,
  registryAddress: string,
  chainId: number,
): Promise<Server[]> {
  try {
    const urls = await getServersUrl(
      from.address,
      to.address,
      registryAddress,
      provider,
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
  registryAddress: string,
  provider: providers.Provider,
) {
  const contract = new ethers.Contract(
    registryAddress,
    makerRegistry,
    provider,
  );
  const quoteTokenURLs: string[] = await contract.getURLsForToken(quoteToken);
  const baseTokenURLs: string[] = await contract.getURLsForToken(baseToken);
  const urls = quoteTokenURLs
    .filter(url => baseTokenURLs.includes(url))
    .filter(url => !(url.startsWith('wss://') || url.startsWith('ws://')))
    .filter(url => url.includes('altono'));
  return Promise.resolve(urls);
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
      new BigNumber(threshold.threshold).isLessThan(amount),
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

// export function computePricesFromLevels(
//   amounts: BigNumber[],
//   _levels: PriceLevel[],
//   srcToken: Token,
//   destToken: Token,
//   side: SwapSide,
// ): bigint[] {
//   const levels = [..._levels]
//   if (levels.length > 0) {
//     const firstLevel = levels[0];
//     if (new BigNumber(firstLevel.level).gt(0)) {
//       // Add zero level for price computation
//       levels.unshift({ level: '0', price: firstLevel.price });
//     }
//   }

//   const outputs = new Array<BigNumber>(amounts.length).fill(BN_0);
//   for (const [index, amount] of amounts.entries()) {
//     if (amount.isZero()) {
//       outputs[index] = BN_0;
//     } else {
//       const output =
//         side === SwapSide.SELL
//           ? computeLevelsQuote(levels, amount, undefined)
//           : computeLevelsQuote(levels, undefined, amount);

//       if (output === undefined) {
//         // If current amount was unfillable, then bigger amounts are unfillable as well
//         break;
//       } else {
//         outputs[index] = output;
//       }
//     }
//   }

//   const decimals =
//     side === SwapSide.SELL ? destToken.decimals : srcToken.decimals;

//   return outputs.map(output => {
//     const exp = getBigNumberPow(decimals);
//     const outputExp = output.multipliedBy(exp);
//     return BigInt(outputExp.toFixed(0));
//   });
// }

// function levelsToLevelsBigNumber(
//   priceLevels: PriceLevel[],
// ): { level: BigNumber; price: BigNumber }[] {
//   return priceLevels.map(l => ({
//     level: new BigNumber(l.level),
//     price: new BigNumber(l.price),
//   }));
// }
// function computeLevelsQuote(
//   priceLevels: PriceLevel[],
//   baseAmount?: BigNumber,
//   quoteAmount?: BigNumber,
// ): BigNumber | undefined {
//   if (priceLevels.length === 0) {
//     return undefined;
//   }
//   const levels = levelsToLevelsBigNumber(priceLevels);

//   const quote = {
//     baseAmount: levels[0].level,
//     quoteAmount: levels[0].level.multipliedBy(levels[0].price),
//   };
//   if (
//     (baseAmount && baseAmount.lt(quote.baseAmount)) ||
//     (quoteAmount && quoteAmount.lt(quote.quoteAmount))
//   ) {
//     return undefined;
//   }

//   for (let i = 1; i < levels.length; i++) {
//     const nextLevel = levels[i];
//     const nextLevelDepth = nextLevel.level.minus(levels[i - 1]!.level);
//     const nextLevelQuote = quote.quoteAmount.plus(
//       nextLevelDepth.multipliedBy(nextLevel.price),
//     );
//     if (baseAmount && baseAmount.lte(nextLevel.level)) {
//       const baseDifference = baseAmount.minus(quote.baseAmount);
//       const quoteAmount = quote.quoteAmount.plus(
//         baseDifference.multipliedBy(nextLevel.price),
//       );
//       return quoteAmount;
//     } else if (quoteAmount && quoteAmount.lte(nextLevelQuote)) {
//       const quoteDifference = quoteAmount.minus(quote.quoteAmount);
//       const baseAmount = quote.baseAmount.plus(
//         quoteDifference.dividedBy(nextLevel.price),
//       );
//       return baseAmount;
//     }

//     quote.baseAmount = nextLevel.level;
//     quote.quoteAmount = nextLevelQuote;
//   }

//   return undefined;
// }
