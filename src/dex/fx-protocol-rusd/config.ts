import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FxProtocolConfig: DexConfigMap<DexParams> = {
  FxProtocolRusd: {
    [Network.MAINNET]: {
      rUSDAddress: '0x65D72AA8DA931F047169112fcf34f52DbaAE7D18',
      weETHAddress: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
      rUSDWeETHMarketAddress: '0x267c6a96db7422faa60aa7198ffeeec4169cd65f',
      weETHOracleAddress: '0xddb6f90ffb4d3257dd666b69178e5b3c5bf41136',
    },
  },
};
