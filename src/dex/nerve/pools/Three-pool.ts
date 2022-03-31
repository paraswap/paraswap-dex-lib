import Web3 from 'web3';
import type { NerveConfig } from '../config';
import { NerveEventPool } from '../nerve-pool';
import { NervePoolConfig } from '../types';

const config: NervePoolConfig = {
  name: 'ThreePool',
  address: '0x1B3771a66ee31180906972580adE9b81AFc5fCDc',
  type: 1,
  coins: [
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 0 - BUSD
    '0x55d398326f99059fF775485246999027B3197955', // 1 - USDT
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 2 - USDC
  ],
  isMetapool: false,
  lpTokenAddress: '0xf2511b5E4FB0e5E2d123004b672BA14850478C14',
  trackCoins: true,
};

export class ThreePool extends NerveEventPool {
  constructor(
    dexKey: string,
    web3Provider: Web3,
    network: number,
    _config = config,
  ) {
    super(dexKey, web3Provider, network, _config);
  }
}
