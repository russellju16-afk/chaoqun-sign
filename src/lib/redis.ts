import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }
  const client = new Redis(url, {
    // Avoid hanging the process on graceful shutdown
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  client.on("error", (err: Error) => {
    console.error("[redis] connection error:", err);
  });

  return client;
}

/**
 * Returns the Redis client, creating it lazily on first access.
 * Accessing this during the Next.js build phase (static page collection)
 * without REDIS_URL set would previously crash at module evaluation time.
 * The lazy getter defers the error to actual runtime usage.
 */
export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient();
  }
  return globalForRedis.redis;
}

// Keep a named export for backward-compatibility using a Proxy so existing
// callers (redis.get / redis.set / etc.) continue to work without changes.
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop: string | symbol) {
    return (getRedis() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
