import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FxProtocolConfig: DexConfigMap<DexParams> = {
  FxProtocolRusd: {
    [Network.MAINNET]: {
      rUSDAddress: '0x65D72AA8DA931F047169112fcf34f52DbaAE7D18',
      weETHAddress: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
      ezETHAddress: '0xbf5495Efe5DB9ce00f80364C8B423567e58d2110',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter02', index: 0 }] },
};
