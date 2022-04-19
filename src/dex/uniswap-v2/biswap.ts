import { UniswapV2 } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import BiSwapPoolABI from '../../abi/uniswap-v2/biswap-pool.json';
import { getDexKeysWithNetwork } from '../../utils';

export const BiSwapConfig: DexConfigMap<DexParams> = {
  BiSwap: {
    [Network.BSC]: {
      factoryAddress: '0x858e3312ed3a876947ea49d572a7c42de08af7ee',
      poolGasCost: 120 * 1000,
      feeCode: 0, // this is ingored as BiSwap uses dynamic fees
    },
  },
};

export class BiSwap extends UniswapV2 {
  biSwapPool: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BiSwapConfig);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      true,
      BiSwapConfig[dexKey][network].factoryAddress,
      BiSwapConfig[dexKey][network].subgraphURL,
      BiSwapConfig[dexKey][network].feeCode,
      BiSwapConfig[dexKey][network].poolGasCost,
    );
    this.biSwapPool = new Interface(BiSwapPoolABI);
  }

  protected getFeesMultiCallData(poolAddress: Address) {
    const callEntry = {
      target: poolAddress,
      callData: this.biSwapPool.encodeFunctionData('swapFee', []),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        this.biSwapPool.decodeFunctionResult('swapFee', values)[0].toString(),
      ) * 10;
    return {
      callEntry,
      callDecoder,
    };
  }
}
