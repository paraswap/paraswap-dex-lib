import { Address } from '../types';

const addresses: any = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  4: '0xc778417e063141139fce010982780140aa0cd5ab',
  42: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
};

export class Weth {
  static getAddress(network: number = 1): Address {
    return addresses[network];
  }
}
