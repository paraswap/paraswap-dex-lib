import { Network, SwapSide } from '../constants';
import { Address } from '../types';
import { IDexTxBuilder } from './idex';
import Web3 from 'web3';
import { UniswapV3, UniswapV3Param } from './uniswap-v3';
import { pack } from '@ethersproject/solidity';
import { IDexHelper } from '../dex-helper';

const NOMISWAP_V3_ROUTER_ADDRESSES: { [network: number]: Address } = {
  [Network.BSC]: '0x6db9831845750b8b8Df97293E90Db7eB9f33e3DC',
};

export type NomiswapV3Data = {
  // ExactInputSingleParams
  deadline?: number;
  path: {
    tokenIn: Address;
    tokenOut: Address;
  }[];
};

export class NomiswapV3
  extends UniswapV3
  implements IDexTxBuilder<NomiswapV3Data, UniswapV3Param>
{
  static dexKeys = ['nomiswapv3'];

  constructor(dexHelper: IDexHelper) {
    super(
      dexHelper,
      'nomiswapv3',
      NOMISWAP_V3_ROUTER_ADDRESSES[dexHelper.config.data.network],
    );
  }

  // override parent as NomiswapV3 handles fees dynamically.
  protected encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      fee: number;
    }[],
    side: SwapSide,
  ): string {
    if (path.length === 0) {
      return '0x';
    }

    const { _path, types } = path.reduce(
      (
        { _path, types }: { _path: string[]; types: string[] },
        curr,
        index,
      ): { _path: string[]; types: string[] } => {
        if (index === 0) {
          return {
            types: ['address', 'address'],
            _path: [curr.tokenIn, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'address'],
            _path: [..._path, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
  }
}
