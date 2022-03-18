import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const BalancerV1Config: DexConfigMap<DexParams> = {
  BalancerV1: {
    // TODO: complete me!
  }
};

export const Adapters: { [chainId: number]: { name: string; index: number }[] | null } = {
  // TODO: add adapters for each chain 
};
