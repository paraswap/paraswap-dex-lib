import NodeCache from 'node-cache';
import { Network } from '../constants';
import { IDexHelper } from '../dex-helper';

type JsonPubSubMsg = {
  expiresAt: number;
  data: Record<string, unknown>;
};

type SetPubSubMsg = string[];

export class JsonPubSub {
  channel: string;
  network: Network;
  localCache: NodeCache = new NodeCache();

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    channel: string,
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;
  }

  initialize() {
    this.subscribe();
  }

  subscribe() {
    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as JsonPubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(data: Record<string, unknown>, ttl: number) {
    const expiresAt = Math.round(Date.now() / 1000) + ttl;
    this.dexHelper.cache.publish(
      this.channel,
      JSON.stringify({ expiresAt, data }),
    );
  }

  handleSubscription(json: JsonPubSubMsg) {
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

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    channel: string,
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;
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
    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as SetPubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(set: SetPubSubMsg) {
    // as there's no lazy load, also store locally
    for (const key of set) {
      this.set.add(key);
    }
    this.dexHelper.cache.publish(this.channel, JSON.stringify(set));
  }

  handleSubscription(set: SetPubSubMsg) {
    for (const key of set) {
      this.set.add(key);
    }
  }

  async has(key: string) {
    return this.set.has(key);
  }
}
