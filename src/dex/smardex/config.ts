import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network } from '../../constants';

const gatewaySubgraph = 'https://subgraph.smardex.io';
const mainnetInitHash =
  '0xb477a06204165d50e6d795c7c216306290eff5d6015f8b65bb46002a8775b548';
const layer2InitHash =
  '0x33bee911475f015247aeb1eebe149d1c6d2669be54126c29d85df6b0abb4c4e9';

export const SmardexConfig: DexConfigMap<DexParams> = {
  Smardex: {
    [Network.MAINNET]: {
      factoryAddress: '0x7753F36E711B66a0350a753aba9F5651BAE76A1D',
      router: '0xEf2f9b48d7EC80440Ab4573dF1A2aBDBE06D3f60',
      initCode: mainnetInitHash,
      subgraphURL: `${gatewaySubgraph}/ethereum`,
      // feeCode: 0, // this is ignored as Smardex uses dynamic fees
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0x41A00e3FbE7F479A99bA6822704d9c5dEB611F22',
      router: '0xdd4536dD9636564D891c919416880a3e250f975A',
      initCode: layer2InitHash,
      subgraphURL: `${gatewaySubgraph}/arbitrum`,
      // feeCode: 0, // this is ignored as Smardex uses dynamic fees
    },
    [Network.BSC]: {
      factoryAddress: '0xA8EF6FEa013034E62E2C4A9Ec1CDb059fE23Af33',
      router: '0x391BeCc8DAaf32b9ba8e602e9527Bf9DA04C8deb',
      initCode: layer2InitHash,
      subgraphURL: `${gatewaySubgraph}/bsc`,
      // feeCode: 0, // this is ignored as Smardex uses dynamic fees
    },
    [Network.POLYGON]: {
      factoryAddress: '0x9A1e1681f6D59Ca051776410465AfAda6384398f',
      router: '0xA8EF6FEa013034E62E2C4A9Ec1CDb059fE23Af33',
      initCode: layer2InitHash,
      subgraphURL: `${gatewaySubgraph}/polygon`,
      // feeCode: 0, // this is ignored as Smardex uses dynamic fees
    },
    [Network.BASE]: {
      factoryAddress: '0xdd4536dD9636564D891c919416880a3e250f975A',
      router: '0x5C622Dcc96b6D96ac6c154f99CF081815094CBC9',
      initCode: layer2InitHash,
      subgraphURL: `${gatewaySubgraph}/base`,
      // feeCode: 0, // this is ignored as Smardex uses dynamic fees
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // This is an example
  // [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
