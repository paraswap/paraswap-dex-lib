import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const GATEWAY_SUBGRAPH = 'https://subgraph.smardex.io';
const MAINNET_INIT_HASH =
  '0xc762a0f9885cc92b9fd8eef224b75997682b634460611bc0f2138986e20b653f';
const LAYER2_INIT_HASH =
  '0x33bee911475f015247aeb1eebe149d1c6d2669be54126c29d85df6b0abb4c4e9';

export const SmardexConfig: DexConfigMap<DexParams> = {
  Smardex: {
    [Network.MAINNET]: {
      factoryAddress: '0xB878DC600550367e14220d4916Ff678fB284214F',
      router: '0xC33984ABcAe20f47a754eF78f6526FeF266c0C6F',
      initCode: MAINNET_INIT_HASH,
      subgraphURL: `${GATEWAY_SUBGRAPH}/ethereum`,
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0x41A00e3FbE7F479A99bA6822704d9c5dEB611F22',
      router: '0xDA3970a20cdc2B1269fc96C4E8D300E0fdDB7b3D',
      initCode: LAYER2_INIT_HASH,
      subgraphURL: `${GATEWAY_SUBGRAPH}/arbitrum`,
    },
    [Network.BSC]: {
      factoryAddress: '0xA8EF6FEa013034E62E2C4A9Ec1CDb059fE23Af33',
      router: '0xaB3699B71e89a53c529eC037C3389B5A2Caf545A',
      initCode: LAYER2_INIT_HASH,
      subgraphURL: `${GATEWAY_SUBGRAPH}/bsc`,
    },
    [Network.POLYGON]: {
      factoryAddress: '0x9A1e1681f6D59Ca051776410465AfAda6384398f',
      router: '0xedD758D17175Dc9131992ebd02F55Cc4ebeb7B7c',
      initCode: LAYER2_INIT_HASH,
      subgraphURL: `${GATEWAY_SUBGRAPH}/polygon`,
    },
    [Network.BASE]: {
      factoryAddress: '0xdd4536dD9636564D891c919416880a3e250f975A',
      router: '0xF03D133627364E5eDDaB8134faB3A030cf7b3020',
      initCode: LAYER2_INIT_HASH,
      subgraphURL: `${GATEWAY_SUBGRAPH}/base`,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 6 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter02', index: 2 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 9 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 8 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 7 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 8 }],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 8 }],
    [SwapSide.BUY]: [{ name: 'BaseBuyAdapter', index: 5 }],
  },
};
