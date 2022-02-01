import { BalancerV2 } from './balancer-v2';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';

const VaultAddress: { [chainId: number]: string } = {
  250: '0x20dd72ed959b6147912c2e529f0a0c651c33c9ce',
};

export class BeetsFi extends BalancerV2 {
  static dexKeys = ['beetsfi'];

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, network, provider, VaultAddress[network]);
  }
}
