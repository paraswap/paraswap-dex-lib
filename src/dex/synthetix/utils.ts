import { ethers } from 'ethers';

export const encodeStringToBytes32 = (value: string) =>
  ethers.utils.formatBytes32String(value);
