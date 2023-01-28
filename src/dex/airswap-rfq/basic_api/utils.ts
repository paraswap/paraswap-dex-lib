import { ethers } from 'ethers';
import { chainNames } from '@airswap/constants';

export const decimals: any = {
  '0x07865c6e87b9f70255377e024ace6630c1eaa37f': 6,
  '0x79c950c7446b234a6ad53b908fbf342b01c4d446': 6,
};

export function getNodeURL(chainId: number, INFURA_ID: string) {
  const selectedChain = chainNames[chainId].toLowerCase();
  switch (chainId) {
    case 56:
      return 'https://bsc-dataseed.binance.org/';
    case 97:
      return 'https://data-seed-prebsc-1-s1.binance.org:8545/';
    case 43113:
      return 'https://api.avax-test.network/ext/bc/C/rpc';
    case 43114:
      return 'https://api.avax.network/ext/bc/C/rpc';
    default:
      return `https://${selectedChain}.infura.io/v3/${INFURA_ID}`;
  }
}
