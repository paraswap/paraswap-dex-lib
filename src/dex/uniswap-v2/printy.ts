import { UniswapV2 } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import PRINTYFactoryABI from '../../abi/uniswap-v2/printy-factory.json';
import { getDexKeysWithNetwork } from '../../utils';

export const PrintyConfig: DexConfigMap<DexParams> = {
  Printy: {
    [Network.AVALANCHE]: {
      factoryAddress: '0xc62Ca231Cd2b0c530C622269dA02374134511a36',
      initCode:
        '0x96262ba85d1e33f4c9f8368149e7211436bc78c7058d43e303e73ffdfb9c0d8e',
      feeCode: 1,
    },
  },
};

export class Printy extends UniswapV2 {
  printyFactory: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(PrintyConfig);

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
      PrintyConfig[dexKey][network].factoryAddress,
      PrintyConfig[dexKey][network].subgraphURL,
      PrintyConfig[dexKey][network].initCode,
      PrintyConfig[dexKey][network].feeCode,
    );
    this.printyFactory = new Interface(PRINTYFactoryABI);
  }
}
