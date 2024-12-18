import NodeCache from 'node-cache';
import { Network } from '../constants';
import { IDexHelper } from '../dex-helper';
import { Logger } from '../types';
import _ from 'lodash';
import jsonDiff from 'json-diff';
import hash from 'object-hash';

type JsonPubSubMsg = {
  expiresAt: number;
  hash: string;
  data: Record<string, unknown>;
};

type SetPubSubMsg = string[];

export class JsonPubSub {
  channel: string;
  network: Network;
  localCache: NodeCache = new NodeCache();

  // TODO-rfq-ps: temporary logger
  logger: Logger;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    channel: string,
    private defaultValue?: any,
    private defaultTTL?: number,
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;

    this.logger = this.dexHelper.getLogger(`JsonPubSub_${this.channel}`);
  }

  subscribe() {
    this.logger.info(`Subscribing to ${this.channel}`);

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as JsonPubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(data: Record<string, unknown>, ttl: number) {
    const hashedData = hash(data);
    this.logger.info(`Publishing to ${this.channel} with hash ${hashedData}`);

    const expiresAt = Math.round(Date.now() / 1000) + ttl;
    this.dexHelper.cache.publish(
      this.channel,
      JSON.stringify({ expiresAt, data, hash: hashedData }),
    );
  }

  handleSubscription(json: JsonPubSubMsg) {
    const { expiresAt, data, hash } = json;

    this.logger.info(`Received message from ${this.channel} with hash ${hash}`);

    const now = Math.round(Date.now() / 1000);
    // calculating ttl as message might come with the delay
    const ttl = expiresAt - now;

    if (ttl > 0) {
      const keys = Object.keys(data);
      for (const key of keys) {
        this.localCache.set(key, data[key], ttl);
      }
    } else {
      this.logger.error('Message has expired', {
        now,
        expiresAt,
        diffInSeconds: now - expiresAt,
        keys: Object.keys(data),
      });
    }
  }

  async getAndCache<T>(key: string): Promise<T | null> {
    const localValue = this.localCache.get<T>(key);

    // if (localValue) {
    //   return localValue;
    // }

    const [value, ttl] = await Promise.all([
      this.dexHelper.cache.get(this.dexKey, this.network, key),
      this.dexHelper.cache.ttl(this.dexKey, this.network, key),
    ]);

    // TODO-rfq-ps: compare local and cache value
    const isEqual = _.isEqual(
      localValue ?? null,
      value ? JSON.parse(value) : null,
    );
    if (!isEqual) {
      this.logger.info(
        `Values are not equal for the key ${key}, local: ${JSON.stringify(
          localValue,
        )}, cache: ${value}, diff: ${jsonDiff.diffString(localValue, value)}`,
      );
    }

    if (value && ttl > 0) {
      // setting ttl same as in cache
      // TODO-ps: check if ttl is not null
      const parsedValue = JSON.parse(value);
      this.localCache.set(key, parsedValue, ttl);
      return parsedValue;
    }

    if (this.defaultValue && this.defaultTTL && this.defaultTTL > 0) {
      this.localCache.set(key, this.defaultValue, this.defaultTTL);
      return this.defaultValue;
    }

    return null;
  }
}

export class SetPubSub {
  channel: string;
  network: Network;
  set = new Set<string>();

  // TODO-rfq-ps: temporary logger
  logger: Logger;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    channel: string,
    private blackListCacheKey: string,
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;

    this.logger = this.dexHelper.getLogger(`SetPubSub_${this.channel}`);
  }

  async initializeAndSubscribe(initialSet: string[]) {
    // as there's no lazy load, we need to initialize the set
    for (const member of initialSet) {
      this.set.add(member);
    }

    this.subscribe();
  }

  subscribe() {
    this.logger.info(`Subscribing to ${this.channel}`);

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as SetPubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(set: SetPubSubMsg) {
    this.logger.info(`Publishing to ${this.channel}`);

    // should not be a problem, as we also subscribe to the channel on the same instance
    // // as there's no lazy load, also store locally
    // for (const key of set) {
    //   this.set.add(key);
    // }
    this.dexHelper.cache.publish(this.channel, JSON.stringify(set));
  }

  handleSubscription(set: SetPubSubMsg) {
    this.logger.info(`Received message from ${this.channel}`);
    for (const key of set) {
      this.set.add(key);
    }
  }

  async has(key: string) {
    const localValue = this.set.has(key);

    const value = await this.dexHelper.cache.sismember(
      this.blackListCacheKey,
      key,
    );

    // TODO-rfq-ps: compare local and cache value
    const isEqual = localValue === value;

    if (!isEqual) {
      this.logger.error('Values are not equal', { localValue, value });
    }

    return value;
  }
}
