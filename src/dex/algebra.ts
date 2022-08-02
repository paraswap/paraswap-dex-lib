import { Network } from '../constants';
import { Address } from '../types';
import { IDexTxBuilder } from './idex';
import Web3 from 'web3';
import { UniswapV3, UniswapV3Data, UniswapV3Param } from './uniswap-v3';

const ALGEBRA_ROUTER_ADDRESSES: { [network: number]: Address } = {
  [Network.POLYGON]: '0x1a5bC2d507465c3e343Ca4e8B5C37Dd6B580f2C2',
};

export class Algebra
  extends UniswapV3
  implements IDexTxBuilder<UniswapV3Data, UniswapV3Param>
{
  static dexKeys = ['algebra'];

  constructor(
    augustusAddress: Address,
    protected network: number,
    provider: Web3,
  ) {
    super(
      augustusAddress,
      network,
      provider,
      ALGEBRA_ROUTER_ADDRESSES[network],
    );
  }
}
