import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { DexParams } from '../gmx/types';
import { Adapters, MorphexConfig } from './config';
import { GMX } from '../gmx/gmx';
import { getDexKeysWithNetwork } from '../../utils';

export class Morphex extends GMX {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MorphexConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected params: DexParams = MorphexConfig[dexKey][network],
  ) {
    super(network, dexKey, dexHelper, adapters, params);
    this.logger = dexHelper.getLogger(dexKey);
  }
}
