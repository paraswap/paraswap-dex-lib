import Web3 from 'web3';
import { Address } from '../types';
import { IDexTxBuilder } from './idex';
import { IDexHelper } from '../dex-helper';
import { DexParams, UniswapParam, UniswapV2Data } from './uniswap-v2/types';
import { Dystopia } from './uniswap-v2/dystopia/dystopia';
import { Network } from '../constants';

const dexKey = 'SpiritSwapV2';

export const spiritSwapV2Config: Record<number, DexParams> = {
  [Network.FANTOM]: {
    factoryAddress: '0x9d3591719038752db0c8bEEe2040FfcC3B2c6B9c',
    // ParaSwap-compatible Router with stable pools support
    router: '0x56a14A1954b5d5FD7C636a24137a93742bA708b9',
    initCode:
      '0x5442fb448d86f32a7d2a9dc1a457e64bf5a6c77415d98802aac4fb5a9dc5ecd9',

    // 10000 / 2000 = 5 in BPS
    stableFee: 5,
    // 10000 / 500 = 20 in BPS
    volatileFee: 20,
    poolGasCost: 180 * 1000,

    // TODO: Not correct, need to update implementation for event based
    feeCode: 5,
  },
};

export class SpiritSwapV2
  extends Dystopia
  implements IDexTxBuilder<UniswapV2Data, UniswapParam>
{
  static dexKeys = [dexKey.toLowerCase()];

  constructor(
    augustusAddress: Address,
    network: Network,
    provider: Web3,
    dexHelper?: IDexHelper,
  ) {
    if (dexHelper === undefined)
      throw new Error(`DexHelper must be provided to ${dexKey}`);
    super(
      network,
      dexKey,
      dexHelper,
      false,
      spiritSwapV2Config[network].factoryAddress,
      spiritSwapV2Config[network].subgraphURL,
      spiritSwapV2Config[network].initCode,
      spiritSwapV2Config[network].stableFee,
      spiritSwapV2Config[network].poolGasCost,
      spiritSwapV2Config[network].router,
    );
  }
}
