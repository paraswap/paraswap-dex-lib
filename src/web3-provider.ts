import { Network } from './constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from './config';
import Web3 from 'web3';

export function getRpcProvider(network: Network, url?: string) {
  return new StaticJsonRpcProvider(
    {
      url: url ?? generateConfig(network).privateHttpProvider,
      allowGzip: true,
    },
    network,
  );
}
