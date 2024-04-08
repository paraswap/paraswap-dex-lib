import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const VirtuSwapConfig: DexConfigMap<DexParams> = {
  VirtuSwap: {
    [Network.POLYGON]: {
      factoryAddress: '0xd4E3668A9C39ebB603f02A6987fC915dBC906B43',
      initCode:
        '0x637bc1e6555f050fef1c3804f2f03647a960ac0a39ac52c519c3c6d9da312ae0',
      router: '0x3E3d15ea98429E546f30215AEfBB69A4244A8Ea9',
      isTimestampBased: false,
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0x389DB0B69e74A816f1367aC081FdF24B5C7C2433',
      initCode:
        '0xdc4e81218e68ffcafc69ffad9b578a347f7fbeae462b5f9ce3c6538deb0443c2',
      router: '0xB455da5a32E7E374dB6d1eDfdb86C167DD983f40',
      isTimestampBased: true,
    },
    // TODO: should something else be added?
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: update names and indexes?
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 4,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'ArbitrumBuyAdapter',
        index: 1,
      },
    ],
  },
};
