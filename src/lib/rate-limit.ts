import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  readonly success: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
}

// ---------------------------------------------------------------------------
// Sliding-window rate limiter (Redis INCR + EXPIRE)
//
// Uses a fixed-window approach keyed by floor(now / windowMs).  Each window
// gets its own Redis key so TTL-based expiry handles cleanup automatically.
// ---------------------------------------------------------------------------

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const redisKey = `rl:${key}:${windowStart}`;

  // Increment the counter and set its TTL on the first touch
  const count = await redis.incr(redisKey);
  if (count === 1) {
    // First request in this window — set expiry so Redis auto-cleans
    await redis.expire(redisKey, windowSeconds * 2); // generous TTL
  }

  const windowResetAt = new Date((windowStart + 1) * windowSeconds * 1000);
  const remaining = Math.max(0, limit - count);

  return {
    success: count <= limit,
    remaining,
    resetAt: windowResetAt,
  };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

/** General API: 60 requests / minute per IP. */
export async function apiRateLimit(ip: string): Promise<RateLimitResult> {
  return rateLimit(`api:${ip}`, 60, 60);
}

/** SMS sending: 5 messages / hour per phone number. */
export async function smsRateLimit(phone: string): Promise<RateLimitResult> {
  return rateLimit(`sms:${phone}`, 5, 3600);
}

/** Login attempts: 10 attempts / 15 minutes per identifier. */
export async function loginRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return rateLimit(`login:${identifier}`, 10, 900);
}

/** Signing endpoint: 5 requests / minute per token. */
export async function signRateLimit(token: string): Promise<RateLimitResult> {
  return rateLimit(`sign:${token}`, 5, 60);
}
