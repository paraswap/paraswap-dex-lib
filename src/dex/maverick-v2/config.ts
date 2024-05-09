import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MAV_V2_BASE_GAS_COST = 50_000;
export const MAV_V2_TICK_GAS_COST = 10_000;

export const MaverickV2Config: DexConfigMap<DexParams> = {
  MaverickV2: {
    [Network.BASE]: {
      poolLensAddress: '0x56eFfDD51b20705e152CAF482D9A6972e97B571C',
      quoterAddress: '0xb40AfdB85a07f37aE217E7D6462e609900dD8D7A',
      apiURL: 'https://maverick-v2-api-delta.vercel.app',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
