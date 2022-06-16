import { UniswapV2 } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import { getDexKeysWithNetwork } from '../../utils';
import TetuSwapPoolABI from '../../abi/uniswap-v2/tetuswap-pool.json';

const tetuSwapPool = new Interface(TetuSwapPoolABI);

export const TetuSwapConfig: DexConfigMap<DexParams> = {
  TetuSwap: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/tetu-io/tetu-swap',
      factoryAddress: '0x684d8c187be836171a1Af8D533e4724893031828',
      router: '0xBCA055F25c3670fE0b1463e8d470585Fe15Ca819',
      initCode: '0x0',
      poolGasCost: 1000 * 1000, // TetuSwap use SmartVault deposits / withdrawals during swap, so its costly
      feeCode: 0, // fee is dynamic, default value for all pools is 10
    },
  },
};

export class TetuSwap extends UniswapV2 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(TetuSwapConfig);

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
      TetuSwapConfig[dexKey][network].factoryAddress,
      TetuSwapConfig[dexKey][network].subgraphURL,
      TetuSwapConfig[dexKey][network].initCode,
      TetuSwapConfig[dexKey][network].feeCode,
      TetuSwapConfig[dexKey][network].poolGasCost,
    );
  }

  protected getFeesMultiCallData(poolAddress: Address) {
    const callEntry = {
      target: poolAddress,
      callData: tetuSwapPool.encodeFunctionData('fee', []),
    };
    const callDecoder = (values: any[]) =>
      parseInt(tetuSwapPool.decodeFunctionResult('fee', values)[0].toString());
    return {
      callEntry,
      callDecoder,
    };
  }
}
