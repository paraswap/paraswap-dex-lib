import { Address, NumberAsString } from '../../types';
import { RPParams } from '@sushiswap/router';

export type SushiSwapV3Data = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
    fee: NumberAsString;
  }[];
  isApproved?: boolean;
  rpParams?: RPParams;
};
