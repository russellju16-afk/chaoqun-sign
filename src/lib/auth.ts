import crypto from "node:crypto";

const SIGN_SECRET = process.env.SIGN_TOKEN_SECRET ?? "";
const EXPIRY_HOURS = Number(process.env.SIGN_TOKEN_EXPIRY_HOURS ?? "72");

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
    .createHmac("sha256", SIGN_SECRET)
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
    .createHmac("sha256", SIGN_SECRET)
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
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}
