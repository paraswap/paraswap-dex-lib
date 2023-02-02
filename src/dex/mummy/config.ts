import {DexParams} from '../gmx/types';
import {DexConfigMap} from '../../types';
import {Network, SwapSide} from '../../constants';

export const MummyConfig: DexConfigMap<DexParams> = {
  Mummy: {
        [Network.FANTOM]: {
            vault: '0xA6D7D0e650aa40FFa42d845A354c12c2bc0aB15f',
            reader: '0xB2a477C6BA5E96f6dECbCEd836cB7d3d32ef9ecD',
            priceFeed: '0x8CbC45D772d2f127693abB8942d46fADEF198B4a',
            fastPriceFeed: '0x198634D01A8E1646faE8676904343c33b1d2C6b9',
            fastPriceEvents: '0x01e9B35785eF3f7Ef2677c371442976bd550f320',
            usdg: '0xCaB2C0A41556149330F4223C9b76d93C610DAfE6',
        },
    },
};

export const Adapters: {
    [chainId: number]: {
        [side: string]: { name: string; index: number }[] | null;
    };
} = {
    [Network.FANTOM]: {
        [SwapSide.SELL]: [
            {
                name: 'FantomAdapter01',
                index: 6,
            },
        ],
    },
};
