import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const LighterV1Config: DexConfigMap<DexParams> = {
  LighterV1: {
    [Network.ARBITRUM]: {
      factory: '0x35642792abC96fA1E9fFe5F2f62A539bB80a8AF4',
      router: '0x033c00fd922AF40b6683Fe5371380831a5b81D57',
      orderBookHelper: '0xa43E0c9e8755D4C8B42E837D74E2888B8184eA93',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.ARBITRUM]: { [SwapSide.SELL]: [{ name: 'LighterV1', index: 0 }] },
};
