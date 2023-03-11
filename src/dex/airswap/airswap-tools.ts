import { providers, utils } from 'ethers';
import { Token } from '../../types';
import { MakerRegistry, Maker } from '@airswap/libraries';
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

export async function getStakersUrl(
  provider: providers.Provider,
  makerAddress: string,
) {
  const logs = await provider.getLogs({
    address: makerAddress,
    fromBlock: 0,
    toBlock: 'latest',
  });

  return decodeDataLog(logs);
}

function decodeDataLog(logs: providers.Log[]) {
  let iface = new utils.Interface(makerRegistry);
  const mappedLog = logs.map(log => {
    const parsed = iface.parseLog(log);
    if (parsed?.eventFragment?.name === 'SetURL') {
      return parsed.args[1];
    }
    return null;
  });
  return mappedLog.filter(url => url !== null);
}

export async function getAvailableMakersForRFQ(
  provider: providers.Provider,
  from: Token,
  to: Token,
  network: number,
): Promise<Maker[]> {
  try {
    const servers = await new MakerRegistry(network, provider).getMakers(
      from.address,
      to.address,
    );
    return Promise.resolve(servers);
  } catch (err) {
    return Promise.resolve([]);
  }
}

export async function makeRFQ(
  maker: Maker,
  senderWallet: string,
  srcToken: Token,
  destToken: Token,
  amount: string,
): Promise<QuoteResponse> {
  const response = await maker.getSignerSideOrder(
    amount.toString(),
    destToken.address,
    srcToken.address,
    senderWallet,
  );
  // console.log('[AIRSWAP]', 'getTx', {
  //   swapContract,
  //   senderWallet,
  //   maker: host,
  //   signedOrder: response,
  // });
  return Promise.resolve({ maker: maker.locator, signedOrder: response });
}
