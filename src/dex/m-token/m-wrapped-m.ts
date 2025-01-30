import { Network } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MToken } from './m-token';
import { DexParams } from './types';
import { DexConfigMap } from '../../types';

export const MWrappedMConfig: DexConfigMap<DexParams> = {
  MWrappedM: {
    [Network.MAINNET]: {
      // TODO: Verify direction
      fromToken: {
        address: '0x437cc33344a0b27a429f795ff6b469c72698b291',
        decimals: 6,
      },
      toToken: {
        address: '0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b',
        decimals: 6,
      },
    },
  },
};

export class MWrappedM extends MToken {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MWrappedMConfig);

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(network, dexKey, dexHelper);
  }
}
