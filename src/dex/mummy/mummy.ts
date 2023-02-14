import {Network} from '../../constants';
import {IDexHelper} from '../../dex-helper';
import {DexParams} from '../gmx/types';
import {Adapters, MummyConfig} from './config';
import {GMX} from '../gmx/gmx';

export class Mummy extends GMX {
    constructor(
        protected network: Network,
        dexKey: string,
        protected dexHelper: IDexHelper,
        protected adapters = Adapters[network],
        protected params: DexParams = MummyConfig[dexKey][network],
    ) {
        super(network, dexKey, dexHelper, adapters, params);
        this.logger = dexHelper.getLogger(dexKey);
    }
}
