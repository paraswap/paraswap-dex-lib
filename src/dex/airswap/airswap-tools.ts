import { Contract, ethers, providers } from 'ethers';
import { Token } from '../../types';
import { Maker } from '@airswap/libraries';
import { PriceLevel, QuoteResponse } from './types';
import axios, { Method } from 'axios';
import BigNumber from 'bignumber.js';
import { BN_0, getBigNumberPow } from '../../bignumber-constants';
import { SwapSide } from '@paraswap/core';
import { url } from 'inspector';

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
): Promise<Maker[]> {
  try {
    const urls = await getServersUrl(
      from.address,
      to.address,
      registryAddress,
      provider,
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
    .filter(url => url.includes("altono"));
  return Promise.resolve(urls);
}

async function getServers(serversUrl: string[]): Promise<Array<Maker>> {
  const serverPromises = (await Promise.allSettled(
    serversUrl.map(url => Maker.at(url)),
  )) as PromiseFulfilledResult<Maker>[];
  return serverPromises
    . filter(promise => promise.status === 'fulfilled')
    .map((promise: PromiseFulfilledResult<Maker>) => promise.value);
}

export async function makeRFQ(
  maker: Maker,
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
        baseToken: 'USDC',
        quoteToken: 'USDT',
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
    return { level: ""+threshold, price: ""+price };
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
