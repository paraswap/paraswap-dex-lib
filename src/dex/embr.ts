import { BalancerV2 } from './balancer-v2';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';

const VaultAddress: { [chainId: number]: string } = {
  43114: '0xad68ea482860cd7077a5D0684313dD3a9BC70fbB',
};

export class Embr extends BalancerV2 {
  static dexKeys = ['embr'];

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, network, provider, VaultAddress[network]);
  }
}
