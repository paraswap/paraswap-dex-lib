import { UniswapV2, UniswapV2Pair } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import excaliburPoolABI from '../../abi/uniswap-v2/excalibur-pool.json';
import { getDexKeysWithNetwork } from '../../utils';

export const ExcaliburConfig: DexConfigMap<DexParams> = {
  Excalibur: {
    [Network.FANTOM]: {
      factoryAddress: '0x08b3CCa975a82cFA6f912E0eeDdE53A629770D3f',
      initCode:
        '0x3b43fe52e9f2b1864ca8a959ca3ac9c5fbc46f6379347e5f7d4e60b0ca479792',
      feeCode: 0, // this is ingored as Excalibur uses dynamic fees
    },
  },
};

export class Excalibur extends UniswapV2 {
  excaliburPool: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ExcaliburConfig);

  constructor(protected dexHelper: IDexHelper, protected dexKey: string) {
    super(
      dexHelper,
      dexKey,
      true,
      ExcaliburConfig[dexKey][dexHelper.network].factoryAddress,
      ExcaliburConfig[dexKey][dexHelper.network].subgraphURL,
      ExcaliburConfig[dexKey][dexHelper.network].initCode,
      ExcaliburConfig[dexKey][dexHelper.network].feeCode,
    );
    this.excaliburPool = new Interface(excaliburPoolABI);
  }

  protected getFeesMultiCallData(pair: UniswapV2Pair) {
    const callEntry = {
      target: pair.exchange!,
      callData: this.excaliburPool.encodeFunctionData('feeAmount', []),
    };
    const callDecoder = (values: any[]) =>
      Math.ceil(
        parseInt(
          this.excaliburPool
            .decodeFunctionResult('feeAmount', values)[0]
            .toString(),
        ) / 10,
      );
    return {
      callEntry,
      callDecoder,
    };
  }
}
