import { Provider } from '@ethersproject/providers';
import { LoggerConstructor } from '../types';
import { ICache } from './icache';
import { IRequestWrapper } from './irequest-wrapper';
import { IBlockManager } from './iblock-manager';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { Token } from '../types';
import { ConfigHelper } from '../config';
import { MultiWrapper } from '../lib/multi-wrapper';

export interface IDexHelper {
  config: ConfigHelper;
  cache: ICache;
  httpRequest: IRequestWrapper;
  multiContract: Contract;
  multiWrapper: MultiWrapper;
  provider: Provider;
  web3Provider: Web3;
  blockManager: IBlockManager;
  getLogger: LoggerConstructor;
  getTokenUSDPrice: (token: Token, amount: bigint) => Promise<number>;
}
