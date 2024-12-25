import NodeCache from 'node-cache';
import { Network } from '../constants';
import { IDexHelper } from '../dex-helper';
import { Logger } from '../types';

type KeyValuePubSubMsg = {
  expiresAt: number;
  data: Record<string, unknown>;
};

type SetPubSubMsg = string[];

export class ExpKeyValuePubSub {
  channel: string;
  network: Network;
  localCache: NodeCache = new NodeCache();

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

    this.logger = this.dexHelper.getLogger(`ExpKeyValuePubSub_${this.channel}`);
  }

  subscribe() {
    this.logger.info(`Subscribing`);

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as KeyValuePubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(data: Record<string, unknown>, ttl: number) {
    if (Object.keys(data).length > 0) {
      const expiresAt = Math.round(Date.now() / 1000) + ttl;
      this.logger.info(
        `Publishing keys: '${Object.keys(data)}', expiresAt: '${expiresAt}'`,
      );

      this.dexHelper.cache.publish(
        this.channel,
        JSON.stringify({ expiresAt, data }),
      );
    }
  }

  handleSubscription(msg: KeyValuePubSubMsg) {
    const { expiresAt, data } = msg;
    this.logger.info(
      `Received subscription, keys: '${Object.keys(
        data,
      )}', expiresAt: '${expiresAt}'`,
    );

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

    if (localValue) {
      return localValue;
    }

    const [value, ttl] = await Promise.all([
      this.dexHelper.cache.get(this.dexKey, this.network, key),
      this.dexHelper.cache.ttl(this.dexKey, this.network, key),
    ]);

    if (value && ttl > 0) {
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

export class NonExpSetPubSub {
  channel: string;
  network: Network;
  set = new Set<string>();

  logger: Logger;

  constructor(
    private dexHelper: IDexHelper,
    private dexKey: string,
    channel: string,
  ) {
    this.network = this.dexHelper.config.data.network;
    this.channel = `${this.network}_${this.dexKey}_${channel}`;

    this.logger = this.dexHelper.getLogger(`NonExpSetPubSub_${this.channel}`);
  }

  async initializeAndSubscribe(initialSet: string[]) {
    this.logger.info(`initializeAndSubscribe with ${initialSet}`);

    for (const member of initialSet) {
      this.set.add(member);
    }

    this.subscribe();
  }

  subscribe() {
    this.logger.info(`Subscribing`);

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as SetPubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(msg: SetPubSubMsg) {
    if (msg.length > 0) {
      this.logger.info(`Publishing msg: '${msg}'`);
      this.dexHelper.cache.publish(this.channel, JSON.stringify(msg));
    }
  }

  handleSubscription(set: SetPubSubMsg) {
    this.logger.info(`Received subscription msg: '${set}'`);

    for (const key of set) {
      this.set.add(key);
    }
  }

  async has(key: string) {
    return this.set.has(key);
  }
}
