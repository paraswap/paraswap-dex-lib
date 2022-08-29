import { UniswapV2, UniswapV2Pair } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import MDEXFactoryABI from '../../abi/uniswap-v2/mdex-factory.json';
import { getDexKeysWithNetwork } from '../../utils';

export const MDEXConfig: DexConfigMap<DexParams> = {
  MDEX: {
    [Network.BSC]: {
      factoryAddress: '0x3cd1c46068daea5ebb0d3f55f6915b10648062b8',
      initCode:
        '0x0d994d996174b05cfc7bed897dc1b20b4c458fc8d64fe98bc78b3c64a6b4d093',
      poolGasCost: 80 * 1000,
      feeCode: 0, // feeCode is ignored as dynamic fees is set to true
    },
  },
};

export class MDEX extends UniswapV2 {
  mdexFactory: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MDEXConfig);

  constructor(protected dexHelper: IDexHelper, protected dexKey: string) {
    super(
      dexHelper,
      dexKey,
      true,
      MDEXConfig[dexKey][dexHelper.network].factoryAddress,
      MDEXConfig[dexKey][dexHelper.network].subgraphURL,
      MDEXConfig[dexKey][dexHelper.network].initCode,
      MDEXConfig[dexKey][dexHelper.network].feeCode,
      MDEXConfig[dexKey][dexHelper.network].poolGasCost,
    );
    this.mdexFactory = new Interface(MDEXFactoryABI);
  }

  protected getFeesMultiCallData(pair: UniswapV2Pair) {
    const callEntry = {
      target: this.factoryAddress,
      callData: this.mdexFactory.encodeFunctionData('getPairFees', [
        pair.exchange!,
      ]),
    };

    const callDecoder = (values: any[]) =>
      parseInt(
        this.mdexFactory
          .decodeFunctionResult('getPairFees', values)[0]
          .toString(),
      );
    return {
      callEntry,
      callDecoder,
    };
  }
}
