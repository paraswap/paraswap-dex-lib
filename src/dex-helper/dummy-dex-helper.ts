import {
  IDexHelper,
  ICache,
  IBlockManager,
  EventSubscriber,
  IRequestWrapper,
} from './index';
import axios from 'axios';
import { Address, LoggerConstructor, Token } from '../types';
// import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider, Provider } from '@ethersproject/providers';
import multiABIV2 from '../abi/multi-v2.json';
import log4js from 'log4js';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { generateConfig, ConfigHelper } from '../config';

// This is a dummy cache for testing purposes
class DummyCache implements ICache {
  async get(
    dexKey: string,
    network: number,
    cacheKey: string,
  ): Promise<string | null> {
    // console.log('Cache Requested: ', dexKey, network, key);
    return null;
  }

  async setex(
    dexKey: string,
    network: number,
    cacheKey: string,
    seconds: number,
    value: string,
  ): Promise<void> {
    // console.log('Cache Stored: ', dexKey, network, cacheKey, seconds, value);
    return;
  }
}

class DummyRequestWrapper implements IRequestWrapper {
  async get(
    url: string,
    timeout?: number,
    headers?: { [key: string]: string | number },
  ) {
    const axiosResult = await axios({
      method: 'get',
      url,
      timeout,
      headers: {
        'User-Agent': 'node.js',
        ...headers,
      },
    });
    return axiosResult.data;
  }

  async post(
    url: string,
    data: any,
    timeout?: number,
    headers?: { [key: string]: string | number },
  ) {
    const axiosResult = await axios({
      method: 'post',
      url,
      data,
      timeout,
      headers: {
        'User-Agent': 'node.js',
        ...headers,
      },
    });
    return axiosResult.data;
  }
}

class DummyBlockManager implements IBlockManager {
  subscribeToLogs(
    subscriber: EventSubscriber,
    contractAddress: Address | Address[],
    afterBlockNumber: number,
  ): void {
    console.log(
      `Subscribed to logs ${subscriber.name} ${contractAddress} ${afterBlockNumber}`,
    );
  }
}

export class DummyDexHelper implements IDexHelper {
  config: ConfigHelper;
  cache: ICache;
  httpRequest: IRequestWrapper;
  provider: Provider;
  multiContract: Contract;
  blockManager: IBlockManager;
  getLogger: LoggerConstructor;
  web3Provider: Web3;
  getTokenUSDPrice: (token: Token, amount: bigint) => Promise<number>;

  constructor(network: number) {
    this.config = new ConfigHelper(generateConfig(network));
    this.cache = new DummyCache();
    this.httpRequest = new DummyRequestWrapper();
    this.provider = new StaticJsonRpcProvider(
      this.config.data.httpProvider,
      network,
    );
    this.web3Provider = new Web3(this.config.data.httpProvider);
    this.multiContract = new this.web3Provider.eth.Contract(
      multiABIV2 as any,
      this.config.data.multicallV2Address,
    );
    this.blockManager = new DummyBlockManager();
    this.getLogger = name => log4js.getLogger(name);
    // For testing use only full parts like 1, 2, 3 ETH, not 0.1 ETH etc
    this.getTokenUSDPrice = async (token, amount) =>
      Number(amount / BigInt(10 ** token.decimals));
  }
}
