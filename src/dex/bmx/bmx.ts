import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { DexParams } from '../gmx/types';
import { Adapters, BMXConfig } from './config';
import { GMX } from '../gmx/gmx';
import { getDexKeysWithNetwork } from '../../utils';

export class BMX extends GMX {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BMXConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected params: DexParams = BMXConfig[dexKey][network],
  ) {
    super(network, dexKey, dexHelper, adapters, params);
    this.logger = dexHelper.getLogger(dexKey);
  }
}
