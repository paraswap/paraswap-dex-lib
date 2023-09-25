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
import { PromiseScheduler } from '../lib/promise-scheduler';

export interface IDexHelper {
  config: ConfigHelper;
  cache: ICache;
  httpRequest: IRequestWrapper;
  multiContract: Contract;
  multiWrapper: MultiWrapper;
  promiseScheduler: PromiseScheduler;
  provider: Provider;
  web3Provider: Web3;
  blockManager: IBlockManager;
  getLogger: LoggerConstructor;
  executeOnWorkerPool: (
    network: number,
    dexKey: string,
    methodSelector: string,
    // For POC it is ok to have any
    payload: any[],
  ) => Promise<any>;
  getTokenUSDPrice: (token: Token, amount: bigint) => Promise<number>;
}
