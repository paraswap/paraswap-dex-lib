import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams } from '../gmx/types';
import { Adapters, OPXConfig } from './config';
import { GMX } from '../gmx/gmx';
export class OPX extends GMX {
  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected params: DexParams = OPXConfig[dexKey][network],
  ) {
    super(network, dexKey, dexHelper, adapters, params);
    this.logger = dexHelper.getLogger(dexKey);
  }
}
