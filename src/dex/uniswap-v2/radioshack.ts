import { UniswapV2 } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import RadioShackPoolABI from '../../abi/uniswap-v2/radioshack-pool.json';
import { getDexKeysWithNetwork } from '../../utils';

export const RadioShackConfig: DexConfigMap<DexParams> = {
  RadioShack: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/radioshackcreator/radioshack-polygon',
      factoryAddress: '0xB581D0A3b7Ea5cDc029260e989f768Ae167Ef39B',
      initCode:
        '0x3eef69365a159891ca18b545ccaf0d6aca9b22c988b8deb7a3e4fa2fc2418596',
      feeCode: 10,
    },
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/radioshackcreator/radioshack-bsc',
      factoryAddress: '0x98957ab49b8bc9f7ddbCfD8BcC83728085ecb238',
      initCode:
        '0x3eef69365a159891ca18b545ccaf0d6aca9b22c988b8deb7a3e4fa2fc2418596',
      feeCode: 10,
    },
  },
};

export class RadioShack extends UniswapV2 {
  radioshackPool: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(RadioShackConfig);

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
      RadioShackConfig[dexKey][network].factoryAddress,
      RadioShackConfig[dexKey][network].subgraphURL,
      RadioShackConfig[dexKey][network].initCode,
      RadioShackConfig[dexKey][network].feeCode,
      RadioShackConfig[dexKey][network].poolGasCost,
    );
    this.radioshackPool = new Interface(RadioShackPoolABI);
  }

  protected getFeesMultiCallData(poolAddress: Address) {
    const callEntry = {
      target: poolAddress,
      callData: this.radioshackPool.encodeFunctionData('swapFee', []),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        this.radioshackPool
          .decodeFunctionResult('swapFee', values)[0]
          .toString(),
      ) * 10;
    return {
      callEntry,
      callDecoder,
    };
  }
}
