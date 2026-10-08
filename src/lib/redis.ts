import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { env } from '../config/env';

class InMemoryRedisMock extends EventEmitter {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    this.store.set(key, value);
    if (mode === 'EX' && duration) {
      setTimeout(() => this.store.delete(key), duration * 1000);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key) ? 1 : 0;
    return deleted;
  }

  async publish(channel: string, message: string): Promise<number> {
    this.emit(`channel:${channel}`, message);
    return 1;
  }

  async subscribe(channel: string, cb?: () => void): Promise<'OK'> {
    if (cb) cb();
    return 'OK';
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

let redisClient: Redis | InMemoryRedisMock;
let redisPub: Redis | InMemoryRedisMock;
let redisSub: Redis | InMemoryRedisMock;

try {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) return null; // Stop reconnecting if not available
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  });

  client.on('error', (err) => {
    // Suppress noisy uncaught errors in local dev without Redis
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Redis] Connection fallback to In-Memory mode:', err.message);
    }
  });

  redisClient = client;
  redisPub = client.duplicate();
  redisSub = client.duplicate();

  // Test connection asynchronously
  client.connect().catch(() => {
    console.info('[Redis] Using resilient In-Memory store for sockets & cache');
    redisClient = new InMemoryRedisMock();
    redisPub = redisClient;
    redisSub = redisClient;
  });
} catch {
  redisClient = new InMemoryRedisMock();
  redisPub = redisClient;
  redisSub = redisClient;
}

export { redisClient, redisPub, redisSub };
export default redisClient;
