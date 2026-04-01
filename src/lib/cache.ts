import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Key helper
// ---------------------------------------------------------------------------

const KEY_PREFIX = "cache:";

function prefixed(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached value. Returns `null` on miss or if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(prefixed(key));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[cache] cacheGet error, key=%s:", key, err);
    return null;
  }
}

/**
 * Store a value in the cache with a TTL (seconds).
 * Silently swallows Redis errors so callers always succeed.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(prefixed(key), JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("[cache] cacheSet error, key=%s:", key, err);
  }
}

/**
 * Invalidate a single cache entry. No-op if the key does not exist.
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(prefixed(key));
  } catch (err) {
    console.error("[cache] cacheDelete error, key=%s:", key, err);
  }
}

// ---------------------------------------------------------------------------
// Cache-aside pattern
// ---------------------------------------------------------------------------

/**
 * Return the cached value for `key`; if absent (or Redis is down), call `fn`,
 * store the result for `ttlSeconds`, then return it.
 *
 * Redis failures are transparent: `fn` is always called as a fallback so the
 * caller never sees a cache-related error.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  // Try the cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss — compute the value
  const value = await fn();

  // Store asynchronously; do not await so callers are not slowed down by Redis
  void cacheSet(key, value, ttlSeconds);

  return value;
}
