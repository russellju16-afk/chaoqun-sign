/**
 * Aliyun OSS signed URL generation using HMAC-SHA1 (OSS V1 signature).
 * No heavy SDK dependency — only Node built-ins (crypto, https).
 *
 * Env vars required:
 *   ALIYUN_OSS_ACCESS_KEY_ID
 *   ALIYUN_OSS_ACCESS_KEY_SECRET
 *   ALIYUN_OSS_BUCKET
 *   ALIYUN_OSS_REGION   e.g. "oss-cn-shenzhen"
 *   ALIYUN_OSS_ENDPOINT (optional override) e.g. "https://oss-cn-shenzhen.aliyuncs.com"
 */

import crypto from "node:crypto";

interface OssConfig {
  readonly accessKeyId: string;
  readonly accessKeySecret: string;
  readonly bucket: string;
  readonly region: string;
  readonly endpoint: string;
}

function getConfig(): OssConfig {
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET ?? "";
  const bucket = process.env.ALIYUN_OSS_BUCKET ?? "";
  const region = process.env.ALIYUN_OSS_REGION ?? "oss-cn-hangzhou";
  const endpoint =
    process.env.ALIYUN_OSS_ENDPOINT ??
    `https://${bucket}.${region}.aliyuncs.com`;

  return { accessKeyId, accessKeySecret, bucket, region, endpoint };
}

/**
 * Build an OSS V1 pre-signed URL.
 * Reference: https://www.alibabacloud.com/help/en/oss/developer-reference/add-signatures-to-urls
 */
function buildPresignedUrl(
  key: string,
  method: "PUT" | "GET",
  expirySeconds: number,
  contentType?: string,
): string {
  const config = getConfig();
  const expireTs = Math.floor(Date.now() / 1000) + expirySeconds;

  // OSS V1 signature string-to-sign:
  // METHOD\nContent-MD5\nContent-Type\nExpires\nCanonicalizedOSSHeaders\nCanonicalizedResource
  const contentMd5 = "";
  const ct = contentType ?? "";
  const canonicalizedResource = `/${config.bucket}/${key}`;
  const stringToSign = [
    method,
    contentMd5,
    ct,
    String(expireTs),
    canonicalizedResource,
  ].join("\n");

  const signature = crypto
    .createHmac("sha1", config.accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const params = new URLSearchParams({
    OSSAccessKeyId: config.accessKeyId,
    Expires: String(expireTs),
    Signature: signature,
  });
  if (ct) params.set("response-content-type", ct);

  return `${config.endpoint}/${key}?${params.toString()}`;
}

/**
 * Generate a pre-signed PUT URL for uploading a signature image or photo.
 * Expiry: 5 minutes.
 */
export function generateUploadUrl(
  key: string,
  contentType = "image/png",
): string {
  return buildPresignedUrl(key, "PUT", 5 * 60, contentType);
}

/**
 * Generate a pre-signed GET URL for viewing a stored object.
 * Expiry: 15 minutes.
 */
export function generateViewUrl(key: string): string {
  return buildPresignedUrl(key, "GET", 15 * 60);
}

/** OSS object key for an order's signature image. */
export function getSignatureImageKey(orderId: string): string {
  return `signs/${orderId}/signature.png`;
}

/** OSS object key for a delivery photo (0-based index). */
export function getPhotoKey(orderId: string, index: number): string {
  return `signs/${orderId}/photo_${index}.jpg`;
}

/**
 * Upload a Buffer directly to OSS via a pre-signed PUT URL.
 * Used server-side when the client sends a base64 data URL instead of
 * uploading directly from the browser.
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const url = generateUploadUrl(key, contentType);
  // Convert Buffer to Uint8Array — the Node.js fetch BodyInit type requires
  // a Web API-compatible type; Buffer is a Uint8Array subclass but the TS
  // overloads don't reflect that, so we cast explicitly.
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(
      `OSS PUT failed for key="${key}": ${response.status} ${response.statusText} — ${text}`,
    );
  }
}

/**
 * Parse a data URL string ("data:<mime>;base64,<data>") into its components.
 * Returns null when the string is not a valid data URL.
 */
export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, b64] = match;
  return { mimeType, buffer: Buffer.from(b64, "base64") };
}
