import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { DexParams } from './types';

export const KyberDmmConfig: DexConfigMap<DexParams> = {
  KyberDmm: {
    [Network.MAINNET]: {
      subgraphURL: '',
      routerAddress: '0x1c87257F5e8609940Bc751a07BB085Bb7f8cDBE6',
      factoryAddress: '0x833e4083B7ae46CeA85695c4f7ed25CDAd8886dE',
      poolGasCost: 150 * 1000,
    },
    [Network.POLYGON]: {
      subgraphURL: '',
      routerAddress: '0x546C79662E028B661dFB4767664d0273184E4dD1',
      factoryAddress: '0x5f1fe642060b5b9658c15721ea22e982643c095c',
      poolGasCost: 150 * 1000,
    },
    [Network.BSC]: {
      subgraphURL: '',
      routerAddress: '0x78df70615ffc8066cc0887917f2Cd72092C86409',
      factoryAddress: '0x878dfe971d44e9122048308301f540910bbd934c',
      poolGasCost: 150 * 1000,
    },
    [Network.AVALANCHE]: {
      subgraphURL: '',
      routerAddress: '0x8Efa5A9AD6D594Cf76830267077B78cE0Bc5A5F8',
      factoryAddress: '0x10908c875d865c66f271f5d3949848971c9595c9',
      poolGasCost: 150 * 1000,
    },
  },
};

export const Adapters: {
  [chainId: number]: { name: string; index: number }[];
} = {
  [Network.MAINNET]: [
    {
      name: 'Adapter03',
      index: 6,
    },
  ],
  [Network.POLYGON]: [
    {
      name: 'BscAdapter01',
      index: 10,
    },
  ],
  [Network.BSC]: [
    {
      name: 'FantomAdapter01',
      index: 12,
    },
  ],
  [Network.AVALANCHE]: [
    {
      name: 'AvalancheAdapter01',
      index: 4,
    },
  ],
};
