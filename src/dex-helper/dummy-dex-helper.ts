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
import { getLogger } from '../lib/log4js';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { generateConfig, ConfigHelper } from '../config';
import { MultiWrapper } from '../lib/multi-wrapper';
import { Response, RequestConfig } from './irequest-wrapper';
import { BlockHeader } from 'web3-eth';
import { PromiseScheduler } from '../lib/promise-scheduler';

const logger = getLogger('DummyDexHelper');

// This is a dummy cache for testing purposes
class DummyCache implements ICache {
  private storage: Record<string, string> = {};

  private setMap: Record<string, Set<string>> = {};

  async get(
    dexKey: string,
    network: number,
    cacheKey: string,
  ): Promise<string | null> {
    const key = `${network}_${dexKey}_${cacheKey}`.toLowerCase();
    if (this.storage[key]) {
      return this.storage[key];
    }
    return null;
  }

  async rawget(key: string): Promise<string | null> {
    return null;
  }

  async rawset(
    key: string,
    value: string,
    ttl: number,
  ): Promise<string | null> {
    return null;
  }

  async rawdel(key: string): Promise<void> {
    return;
  }

  async setex(
    dexKey: string,
    network: number,
    cacheKey: string,
    ttlSeconds: number,
    value: string,
  ): Promise<void> {
    this.storage[`${network}_${dexKey}_${cacheKey}`.toLowerCase()] = value;
    return;
  }

  async getAndCacheLocally(
    dexKey: string,
    network: number,
    cacheKey: string,
    _ttlSeconds: number,
  ): Promise<string | null> {
    const key = `${network}_${dexKey}_${cacheKey}`.toLowerCase();
    if (this.storage[key]) {
      return this.storage[key];
    }
    return null;
  }

  async setexAndCacheLocally(
    dexKey: string,
    network: number,
    cacheKey: string,
    ttlSeconds: number,
    value: string,
  ): Promise<void> {
    return;
  }

  async sadd(setKey: string, key: string): Promise<void> {
    let set = this.setMap[setKey];
    if (!set) {
      this.setMap[setKey] = new Set();
      set = this.setMap[setKey];
    }

    set.add(key);
  }

  async zremrangebyscore(key: string, min: number, max: number) {
    return 0;
  }

  async zadd(key: string, bulkItemsToAdd: (number | string)[], option?: 'NX') {
    return 0;
  }

  async zscore() {
    return null;
  }

  async sismember(setKey: string, key: string): Promise<boolean> {
    let set = this.setMap[setKey];
    if (!set) {
      return false;
    }

    return set.has(key);
  }

  async hset(mapKey: string, key: string, value: string): Promise<void> {
    return;
  }

  async hget(mapKey: string, key: string): Promise<string | null> {
    return null;
  }

  async publish(channel: string, msg: string): Promise<void> {
    return;
  }

  subscribe(
    channel: string,
    cb: (channel: string, msg: string) => void,
  ): () => void {
    return () => {};
  }

  addBatchHGet(
    mapKey: string,
    key: string,
    cb: (result: string | null) => boolean,
  ): void {}
}

export class DummyRequestWrapper implements IRequestWrapper {
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

  request<T = any, R = Response<T>>(config: RequestConfig<any>): Promise<R> {
    return axios.request(config);
  }
}

class DummyBlockManager implements IBlockManager {
  constructor(public _blockNumber: number = 42) {}

  subscribeToLogs(
    subscriber: EventSubscriber,
    contractAddress: Address | Address[],
    afterBlockNumber: number,
  ): void {
    logger.info(
      `Subscribed to logs ${subscriber.name} ${contractAddress} ${afterBlockNumber}`,
    );
    subscriber.isTracking = () => true;
  }

  getLatestBlockNumber(): number {
    return this._blockNumber;
  }

  getActiveChainHead(): Readonly<BlockHeader> {
    return {
      number: this._blockNumber,
      hash: '0x42',
    } as BlockHeader;
  }
}

export class DummyDexHelper implements IDexHelper {
  config: ConfigHelper;
  cache: ICache;
  httpRequest: IRequestWrapper;
  provider: Provider;
  multiContract: Contract;
  multiWrapper: MultiWrapper;
  promiseScheduler: PromiseScheduler;
  blockManager: IBlockManager;
  getLogger: LoggerConstructor;
  web3Provider: Web3;
  getTokenUSDPrice: (token: Token, amount: bigint) => Promise<number>;

  constructor(network: number, rpcUrl?: string) {
    this.config = new ConfigHelper(false, generateConfig(network), 'is');
    this.cache = new DummyCache();
    this.httpRequest = new DummyRequestWrapper();
    this.provider = new StaticJsonRpcProvider(
      rpcUrl ? rpcUrl : this.config.data.privateHttpProvider,
      network,
    );
    this.web3Provider = new Web3(
      rpcUrl ? rpcUrl : this.config.data.privateHttpProvider,
    );
    this.multiContract = new this.web3Provider.eth.Contract(
      multiABIV2 as any,
      this.config.data.multicallV2Address,
    );
    this.blockManager = new DummyBlockManager();
    this.getLogger = name => {
      const logger = log4js.getLogger(name);
      logger.level = 'debug';
      return logger;
    };
    // For testing use only full parts like 1, 2, 3 ETH, not 0.1 ETH etc
    this.getTokenUSDPrice = async (token, amount) =>
      Number(amount / BigInt(10 ** token.decimals));
    this.multiWrapper = new MultiWrapper(
      this.multiContract,
      this.getLogger(`MultiWrapper-${network}`),
    );

    this.promiseScheduler = new PromiseScheduler(
      100,
      5,
      this.getLogger(`PromiseScheduler-${network}`),
    );
  }

  replaceProviderWithRPC(rpcUrl: string) {
    this.provider = new StaticJsonRpcProvider(rpcUrl, this.config.data.network);
  }
}
