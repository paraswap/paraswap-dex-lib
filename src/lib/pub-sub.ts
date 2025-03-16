import NodeCache from 'node-cache';
import { Network } from '../constants';
import { IDexHelper } from '../dex-helper';
import { Logger } from '../types';
import { Utils } from '../utils';

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

  private localCacheHits = 0;
  private localCacheMisses = 0;
  private redisCacheHits = 0;
  private redisCacheMisses = 0;
  private cacheLogInterval = parseInt(
    process.env.CACHE_LOG_INTERVAL || '1000',
    10,
  );

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
    this.logger.info(
      `Subscribing to ${this.channel} with isSlave=${this.dexHelper.config.isSlave}`,
    );

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      try {
        const decodedMsg = JSON.parse(msg) as KeyValuePubSubMsg;
        this.handleSubscription(decodedMsg);
      } catch (error: any) {
        this.logger.error(
          `Failed to process pub/sub message: ${error?.message}`,
          {
            channel: this.channel,
            messagePreview: msg.substring(0, 100),
          },
        );
      }
    });
  }

  publish(data: Record<string, unknown>, ttl: number) {
    const expiresAt = Math.round(Date.now() / 1000) + ttl;
    this.logger.debug(
      `Publishing to ${this.channel} with keys: ${Object.keys(data).join(
        ', ',
      )}, TTL: ${ttl}`,
    );
    this.dexHelper.cache.publish(
      this.channel,
      JSON.stringify({ expiresAt, data }),
    );
  }

  handleSubscription(msg: KeyValuePubSubMsg) {
    const { expiresAt, data } = msg;

    const now = Math.round(Date.now() / 1000);
    // calculating ttl as message might come with the delay
    const ttl = expiresAt - now;

    if (ttl > 0) {
      const keys = Object.keys(data);
      for (const key of keys) {
        this.logger.debug(`Setting local cache for ${key} with TTL ${ttl}`);
        this.localCache.set(key, data[key], ttl);
      }
    } else {
      this.logger.error('Message has expired', {
        now,
        expiresAt,
        diffInSeconds: now - expiresAt,
        keys: Object.keys(data),
        channel: this.channel,
      });
    }
  }

  async getAndCache<T>(key: string): Promise<T | null> {
    const localValue = this.localCache.get<T>(key);

    if (localValue) {
      this.localCacheHits++;
      if (this.localCacheHits % this.cacheLogInterval === 0) {
        this.logger.info(
          `Cache stats for ${this.channel}: local hits=${this.localCacheHits}, local misses=${this.localCacheMisses}, redis hits=${this.redisCacheHits}, redis misses=${this.redisCacheMisses}`,
        );
      }
      return localValue;
    }

    this.localCacheMisses++;
    const cacheKey = `${this.dexKey}_${this.network}_${key}`;

    this.logger.info(`Cache miss for ${cacheKey} in local cache`);

    try {
      const [value, ttl] = await Promise.all([
        this.dexHelper.cache.get(this.dexKey, this.network, key),
        this.dexHelper.cache.ttl(this.dexKey, this.network, key),
      ]);

      if (value && ttl > 0) {
        this.redisCacheHits++;
        this.logger.info(`Redis cache hit for ${cacheKey} with TTL ${ttl}`);
        const parsedValue = JSON.parse(value);
        this.localCache.set(key, parsedValue, ttl);
        return parsedValue;
      } else if (value) {
        this.redisCacheMisses++;
        this.logger.warn(
          `Redis cache hit for ${cacheKey} but TTL is ${ttl} (expired)`,
        );
      } else {
        this.redisCacheMisses++;
        this.logger.info(`Redis cache miss for ${cacheKey}`);
      }

      if (this.defaultValue && this.defaultTTL && this.defaultTTL > 0) {
        this.logger.info(
          `Using default value for ${cacheKey} with TTL ${this.defaultTTL}`,
        );
        this.localCache.set(key, this.defaultValue, this.defaultTTL);
        return this.defaultValue;
      }

      return null;
    } catch (error: any) {
      this.logger.error(
        `Error fetching from Redis for ${cacheKey}: ${error.message}`,
      );
      return null;
    }
  }
}

export class ExpStringPubSub {
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
    this.logger.info(`Subscribing to ${this.channel}`);

    this.dexHelper.cache.subscribe(this.channel, (_, msg) => {
      const decodedMsg = JSON.parse(msg) as KeyValuePubSubMsg;
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

  handleSubscription(msg: KeyValuePubSubMsg) {
    const { expiresAt, data } = msg;

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

export class ExpHashPubSub {
  localCache: NodeCache = new NodeCache();

  logger: Logger;

  constructor(
    private dexHelper: IDexHelper,
    private hashKey: string,
    // in seconds
    private ttl: number,
  ) {
    this.hashKey = hashKey;
    this.logger = this.dexHelper.getLogger(`ExpKeyValuePubSub_${this.hashKey}`);
  }

  subscribe() {
    this.logger.info(`Subscribing`);

    this.dexHelper.cache.subscribe(this.hashKey, (_, msg) => {
      const decodedMsg = Utils.Parse(msg) as KeyValuePubSubMsg;
      this.handleSubscription(decodedMsg);
    });
  }

  publish(data: Record<string, unknown>) {
    if (Object.keys(data).length > 0) {
      const expiresAt = Math.round(Date.now() / 1000) + this.ttl;

      this.dexHelper.cache.publish(
        this.hashKey,
        Utils.Serialize({ expiresAt, data }),
      );
    }
  }

  handleSubscription(msg: KeyValuePubSubMsg) {
    const { expiresAt, data } = msg;

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

    if (localValue !== undefined) {
      return localValue;
    }

    const value = await this.dexHelper.cache.hget(this.hashKey, key);

    if (value && this.ttl > 0) {
      const parsedValue = Utils.Parse(value);
      this.localCache.set(key, parsedValue, this.ttl);
      return parsedValue;
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
      this.dexHelper.cache.publish(this.channel, JSON.stringify(msg));
    }
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
