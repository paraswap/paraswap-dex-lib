import Web3 from 'web3';
import { Address } from '../types';
import { IDexTxBuilder } from './idex';
import { IDexHelper } from '../dex-helper';
import { DexParams, UniswapParam, UniswapV2Data } from './uniswap-v2/types';
import { Dystopia } from './uniswap-v2/dystopia/dystopia';
import { Network } from '../constants';

const dexKey = 'Solidly';

export const SolidlyConfig: Record<number, DexParams> = {
  [Network.FANTOM]: {
    subgraphURL: 'https://api.thegraph.com/subgraphs/name/deusfinance/solidly',
    factoryAddress: '0x3faab499b519fdc5819e3d7ed0c26111904cbc28',
    // ParaSwap-compatible Router with stable pools support
    router: '0x56a14A1954b5d5FD7C636a24137a93742bA708b9',
    initCode:
      '0x57ae84018c47ebdaf7ddb2d1216c8c36389d12481309af65428eb6d460f747a4',
    stableFee: 1,
    volatileFee: 1,
    poolGasCost: 180 * 1000,

    feeCode: 1, // Not used - set for type. TODO: clean up when move to fully event based
  },
};

export class Solidly
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
      SolidlyConfig[network].factoryAddress,
      SolidlyConfig[network].subgraphURL,
      SolidlyConfig[network].initCode,
      SolidlyConfig[network].stableFee,
      SolidlyConfig[network].poolGasCost,
      SolidlyConfig[network].router,
    );
  }
}
