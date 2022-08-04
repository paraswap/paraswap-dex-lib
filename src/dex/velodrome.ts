import Web3 from 'web3';
import { Address } from '../types';
import { IDexTxBuilder } from './idex';
import { IDexHelper } from '../dex-helper';
import { DexParams, UniswapParam, UniswapV2Data } from './uniswap-v2/types';
import { Dystopia } from './uniswap-v2/dystopia/dystopia';
import { Network } from '../constants';

const dexKey = 'Velodrome';

export const VelodromConfig: Record<number, DexParams> = {
  [Network.OPTIMISM]: {
    subgraphURL: '', // none
    factoryAddress: '0x25cbddb98b35ab1ff77413456b31ec81a6b6b746',
    router: '0x', // TODO replace // ParaSwap-compatible Router with stable pools support
    initCode:
      '0xc1ac28b1c4ebe53c0cff67bab5878c4eb68759bb1e9f73977cd266b247d149f0',
    stableFee: 2,
    volatileFee: 2,
    poolGasCost: 180 * 1000,

    feeCode: 2, // Not used - set for type. TODO: clean up when move to fully event based
  },
};

export class Velodrome
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
      true,
      VelodromConfig[network].factoryAddress,
      VelodromConfig[network].subgraphURL,
      VelodromConfig[network].initCode,
      VelodromConfig[network].stableFee,
      VelodromConfig[network].poolGasCost,
      VelodromConfig[network].router,
    );
  }
}
