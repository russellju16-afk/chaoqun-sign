import crypto from "node:crypto";

const EXPIRY_HOURS = Number(process.env.SIGN_TOKEN_EXPIRY_HOURS ?? "72");

/**
 * Resolve the signing secret at call time rather than module-load time.
 * This avoids crashing imported modules at build or edge-cold-start phase
 * while still failing loudly when the secret is actually needed at runtime.
 * An empty / missing secret makes all sign tokens trivially forgeable.
 */
function requireSignSecret(): string {
  const secret = process.env.SIGN_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "[auth] SIGN_TOKEN_SECRET environment variable is not set. " +
        "Set it to a strong random string before starting the server.",
    );
  }
  return secret;
}

interface TokenPayload {
  orderId: string;
  exp: number;
}

/** Generate a time-limited HMAC token for a delivery order signing URL. */
export function generateSignToken(orderId: string): {
  token: string;
  expiry: Date;
} {
  const exp = Date.now() + EXPIRY_HOURS * 3600 * 1000;
  const payload = JSON.stringify({ orderId, exp });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", requireSignSecret())
    .update(encoded)
    .digest("base64url");
  return {
    token: `${encoded}.${sig}`,
    expiry: new Date(exp),
  };
}

/** Verify and decode a sign token. Returns null if invalid or expired. */
export function verifySignToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  const expectedSig = crypto
    .createHmac("sha256", requireSignSecret())
    .update(encoded)
    .digest("base64url");

  if (sig !== expectedSig) return null;

  try {
    const payload: TokenPayload = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    );
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Verify inbound webhook HMAC signature. */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  // timingSafeEqual throws a RangeError when the two buffers have different
  // byte lengths, which would happen any time an attacker (or misconfigured
  // caller) sends a header value whose length differs from the 64-char hex
  // digest.  Convert both to the same fixed-length Buffer before comparing.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.byteLength !== expBuf.byteLength) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
