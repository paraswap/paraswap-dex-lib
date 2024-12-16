import NodeCache from 'node-cache';
import { Network } from '../constants';
import { IDexHelper } from '../dex-helper';
import { Logger } from '../types';

type JsonPubSubMsg = {
  expiresAt: number;
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
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;

    this.logger = this.dexHelper.getLogger(`JsonPubSub_${this.channel}`);
  }

  initialize() {
    this.subscribe();
  }

  subscribe() {
    this.logger.info(`Subscribing to ${this.channel}`);

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as JsonPubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(data: Record<string, unknown>, ttl: number) {
    this.logger.info(`Publishing to ${this.channel}`);

    const expiresAt = Math.round(Date.now() / 1000) + ttl;
    this.dexHelper.cache.publish(
      this.channel,
      JSON.stringify({ expiresAt, data }),
    );
  }

  handleSubscription(json: JsonPubSubMsg) {
    this.logger.info(`Received message from ${this.channel}`);

    const { expiresAt, data } = json;

    const now = Math.round(Date.now() / 1000);
    // calculating ttl as message might come with the delay
    const ttl = expiresAt - now;

    const keys = Object.keys(data);
    for (const key of keys) {
      this.localCache.set(key, data[key], ttl);
    }
  }

  async getAndCache<T>(key: string): Promise<T | null> {
    const localValue = this.localCache.get<T>(key);

    if (localValue) {
      return localValue;
    }

    const [value, ttl] = await Promise.all([
      this.dexHelper.cache.get(this.dexKey, this.network, key),
      this.dexHelper.cache.ttl(this.dexKey, this.network, key),
    ]);

    if (value) {
      // setting ttl same as in cache
      // TODO-ps: check if ttl is not null
      const parsedValue = JSON.parse(value);
      this.localCache.set(key, parsedValue, Number(ttl));
      return parsedValue;
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
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;

    this.logger = this.dexHelper.getLogger(`SetPubSub_${this.channel}`);
  }

  async initialize(key: string) {
    // as there's no lazy load, we need to initialize the set
    const initSet = await this.dexHelper.cache.smembers(key);
    for (const member of initSet) {
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

    // as there's no lazy load, also store locally
    for (const key of set) {
      this.set.add(key);
    }
    this.dexHelper.cache.publish(this.channel, JSON.stringify(set));
  }

  handleSubscription(set: SetPubSubMsg) {
    this.logger.info(`Received message from ${this.channel}`);
    for (const key of set) {
      this.set.add(key);
    }
  }

  async has(key: string) {
    return this.set.has(key);
  }
}
