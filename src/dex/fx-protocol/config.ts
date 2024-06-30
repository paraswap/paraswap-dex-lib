import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FxProtocolConfig: DexConfigMap<DexParams> = {
  FxProtocol: {
    [Network.MAINNET]: {
      rUSDAddress: '0x65D72AA8DA931F047169112fcf34f52DbaAE7D18',
      weETHAddress: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
      // rUSD_weETH_Treasury: '0x781BA968d5cc0b40EB592D5c8a9a3A4000063885',
      // rUSD_weETH_Market: '0x267C6A96Db7422faA60Aa7198FfEeeC4169CD65f',
      // rUSD_weETH_FractionalToken: '0x9216272158F563488FfC36AFB877acA2F265C560',
      // rUSD_weETH_LeveragedToken: '0xACB3604AaDF26e6C0bb8c720420380629A328d2C',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter02', index: 0 }] },
};
