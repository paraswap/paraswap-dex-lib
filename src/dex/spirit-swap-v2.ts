import Web3 from 'web3';
import { Address } from '../types';
import { IDexTxBuilder } from './idex';
import { IDexHelper } from '../dex-helper';
import { UniswapParam, UniswapV2Data } from './uniswap-v2/types';
import { Dystopia } from './uniswap-v2/dystopia/dystopia';

const dexKey = 'SpiritSwapV2';

export class SpiritSwapV2
  extends Dystopia
  implements IDexTxBuilder<UniswapV2Data, UniswapParam>
{
  static dexKeys = [dexKey.toLowerCase()];

  constructor(
    augustusAddress: Address,
    network: number,
    provider: Web3,
    dexHelper?: IDexHelper,
  ) {
    if (dexHelper === undefined)
      throw new Error(`DexHelper must be provided to ${dexKey}`);
    super(network, dexKey, dexHelper);
  }
}
