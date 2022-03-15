import { Address } from '../../types';
import { WethConfig } from './config';

export const isWETH = (address: Address, dexKey: string, network = 1) =>
  WethConfig[dexKey][network].contractAddress.toLowerCase() ===
  address.toLowerCase();
