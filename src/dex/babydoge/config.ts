import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const BabydogeSwapConfig: DexConfigMap<DexParams> = {
  Babydoge: {
    [Network.BSC]: {
      subgraphURL:
        'https://graph-bsc-mainnet.babydoge.com/subgraphs/name/babydoge/exchange',
      factoryAddress: '0x4693B62E5fc9c0a45F89D62e6300a03C85f43137',
      initCode:
        '0x5646bd1da4b93040d09d9a44666ac5ad7d4eb0711841defc40f00dce1aba0b06',
      poolGasCost: 80 * 1000,
      feeCode: 25,
      router: '0xC9a0F685F39d05D835c369036251ee3aEaaF3c47',
    },
    [Network.BSC_TEST]: {
      subgraphURL:
        'https://graph-bsc-testnet.babydoge.com/subgraphs/name/babydoge/exchange',
      factoryAddress: '0x22187FDf63883a7A45c2dfCbC88721F4ac95e062',
      initCode:
        '0xfddc8bd1082c26d0809ac77a68d86901be4e4b567020336f11f1411f404db7f4',
      poolGasCost: 80 * 1000,
      feeCode: 25,
      router: '0xa18f36819023ABe64a1D811E529f6bc83fEF9572',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter01',
        index: 3,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BscBuyAdapter',
        index: 1,
      },
    ],
  },
};
