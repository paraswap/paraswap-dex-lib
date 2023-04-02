import { Contract, ethers, providers } from 'ethers';
import { Token } from '../../types';
import { Maker } from '@airswap/libraries';
import { QuoteResponse } from './types';

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
    .filter(url => !(url.startsWith('wss://') || url.startsWith('ws://')));
  return Promise.resolve(urls);
}

async function getServers(serversUrl: string[]): Promise<Array<Maker>> {
  const serverPromises = (await Promise.allSettled(
    serversUrl.map(url => Maker.at(url)),
  )) as PromiseFulfilledResult<Maker>[];
  return serverPromises
    .filter(promise => promise.status === 'fulfilled')
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
