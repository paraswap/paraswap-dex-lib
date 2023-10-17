import { Address } from '../../types';
import { DexParams as UniswapV2DexParams } from '../uniswap-v2/types';
export interface DexParams extends Omit<UniswapV2DexParams, 'feeCode'> {
  quoteAddress: Address;
}
