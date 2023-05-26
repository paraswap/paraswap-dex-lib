import { PublicClient, Address, Transport, Chain } from 'viem';
import { Token } from '@sushiswap/currency';

import ERC20Abi from '../../abi/erc20.json';

export async function getToken({
  web3Client,
  address,
}: {
  web3Client: PublicClient<Transport, Chain>;
  address: string;
}) {
  const decimals: number = (await web3Client.readContract({
    address: address as Address,
    abi: ERC20Abi,
    functionName: 'decimals',
    args: [],
  })) as unknown as number;

  return new Token({
    address,
    chainId: web3Client.chain.id,
    decimals,
  });
}
