import {
  IDexHelper,
  ICache,
  IBlockManager,
  EventSubscriber,
  IRequestWrapper,
  SubscriberInfo,
  SubscriberFetcher,
} from './index';
import axios from 'axios';
import { Address, LoggerConstructor } from '../types';
import { MULTI_V2, ProviderURL, AugustusAddress } from '../constants';
// import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider, Provider } from '@ethersproject/providers';
import multiABIV2 from '../abi/multi-v2.json';
import log4js from 'log4js';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

// This is a dummy cache for testing purposes
class DummyCache implements ICache {
  async getKey(key: string): Promise<string | null> {
    return null;
  }

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
  getEventSubscriber: SubscriberFetcher | null = null;

  attachGetSubscriber(getSubscriber: SubscriberFetcher) {
    this.getEventSubscriber = getSubscriber;
  }

  isAlreadySubscribedToLogs<T>(subscriberInfo: SubscriberInfo<T>): boolean {
    return false;
  }

  subscribeToLogs(
    subscriberInfo: SubscriberInfo<any>,
    isActive: boolean,
  ): EventSubscriber<any> {
    if (!this.getEventSubscriber) throw new Error('getEventSubscriber not set');
    console.log(
      `Subscribed to logs ${subscriberInfo.dexKey}:${subscriberInfo.identifier} ${subscriberInfo.addressSubscribed} ${subscriberInfo.afterBlockNumber}`,
    );
    return this.getEventSubscriber(subscriberInfo);
  }

  lazyUpdate<T>(identifier: string, update: T | null, blockNumber: number) {}
}

export class DummyDexHelper implements IDexHelper {
  network: number;
  cache: ICache;
  httpRequest: IRequestWrapper;
  augustusAddress: Address;
  provider: Provider;
  multiContract: Contract;
  blockManager: IBlockManager;
  getLogger: LoggerConstructor;
  web3Provider: Web3;

  constructor(network: number) {
    this.network = network;
    this.cache = new DummyCache();
    this.httpRequest = new DummyRequestWrapper();
    this.augustusAddress = AugustusAddress[network];
    this.provider = new StaticJsonRpcProvider(ProviderURL[network], network);
    this.web3Provider = new Web3(ProviderURL[network]);
    this.multiContract = new this.web3Provider.eth.Contract(
      multiABIV2 as any,
      MULTI_V2[network],
    );
    this.blockManager = new DummyBlockManager();
    this.getLogger = name => log4js.getLogger(name);
  }
}
