import { redis } from "@/lib/redis";

/** TTL for a stored verification code (seconds) */
const CODE_TTL_SECONDS = 5 * 60; // 5 minutes

/** Minimum gap between two code requests for the same phone (seconds) */
const RATE_LIMIT_SECONDS = 60;

function redisKey(phone: string): string {
  return `verify:${phone}`;
}

/**
 * Generate a random 6-digit verification code, store it in Redis with a 5-minute
 * TTL, and return the code string.
 *
 * Rate-limited: throws if a code was issued within the last 60 seconds.
 */
export async function generateAndStoreCode(phone: string): Promise<string> {
  const key = redisKey(phone);

  // Check whether a recent code still has > (CODE_TTL_SECONDS - RATE_LIMIT_SECONDS) TTL left,
  // which means it was issued less than RATE_LIMIT_SECONDS ago.
  const ttl = await redis.ttl(key);
  if (ttl > CODE_TTL_SECONDS - RATE_LIMIT_SECONDS) {
    const waitSeconds = ttl - (CODE_TTL_SECONDS - RATE_LIMIT_SECONDS);
    throw new Error(`请求过于频繁，请 ${waitSeconds} 秒后再试`);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(key, code, "EX", CODE_TTL_SECONDS);
  return code;
}

/**
 * Verify a code for a given phone.
 * - Returns true and deletes the key on success.
 * - Returns false if the code does not match or has expired.
 */
export async function verifyCode(
  phone: string,
  code: string,
): Promise<boolean> {
  const key = redisKey(phone);
  const stored = await redis.get(key);

  if (stored === null) {
    // Key expired or was never set
    return false;
  }

  if (stored !== code) {
    return false;
  }

  // Delete on first successful use to prevent replay
  await redis.del(key);
  return true;
}
