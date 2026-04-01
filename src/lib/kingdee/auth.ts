/**
 * Kingdee 云星辰 API — 签名认证模块。
 *
 * 实现两种签名:
 * 1. app_signature — 用于换取 app-token（HMAC-SHA256(app_key, appSecret)）
 * 2. X-Api-Signature — 用于每次 API 请求的签名校验
 *
 * 签名算法严格遵循金蝶官方文档。
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// HMAC-SHA256 → hex → Base64 (金蝶标准流程)
// ---------------------------------------------------------------------------

function hmacSha256Base64(key: string, message: string): string {
  const digest = crypto
    .createHmac("sha256", key)
    .update(message)
    .digest("hex");
  return Buffer.from(digest).toString("base64");
}

// ---------------------------------------------------------------------------
// app_signature (用于换取 app-token)
// ---------------------------------------------------------------------------

/**
 * 构建用于换取 app-token 的 app_signature。
 * 算法: HMAC-SHA256(app_key, appSecret) → hex → Base64
 * 其中 app_key 是签名内容，appSecret 是密钥。
 */
export function buildAppSignature(appKey: string, appSecret: string): string {
  return hmacSha256Base64(appSecret, appKey);
}

// ---------------------------------------------------------------------------
// X-Api-Signature (用于每次 API 请求)
// ---------------------------------------------------------------------------

export interface SignatureComponents {
  readonly signature: string;
  readonly nonce: string;
  readonly timestamp: string;
}

/**
 * URL 编码（斜杠也编码: / → %2F）。
 * 与 Python 的 `quote(s, safe="")` 等效。
 */
function encodeAll(s: string): string {
  return encodeURIComponent(s);
}

/**
 * 构建 API 请求的 X-Api-Signature。
 *
 * 签名明文格式 (5 部分，换行连接):
 * 1. HTTP 方法 (大写: GET / POST / DELETE)
 * 2. URL path (全部 URL 编码，含斜杠)
 * 3. 参数字符串 (二次 URL 编码，按参数名 ASCII 升序排列)
 * 4. x-api-nonce:值 (小写)
 * 5. x-api-timestamp:值 (小写，末尾有换行符)
 *
 * 使用 clientSecret 作为 HMAC-SHA256 密钥。
 */
export function buildApiSignature(opts: {
  method: string;
  path: string;
  params: Record<string, string> | null;
  clientSecret: string;
  nonce?: string;
  timestamp?: string;
}): SignatureComponents {
  const nonce =
    opts.nonce ??
    String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
  const timestamp = opts.timestamp ?? String(Date.now());

  // 1. HTTP 方法大写
  const methodUpper = opts.method.toUpperCase();

  // 2. URL 路径编码（斜杠也编码）
  const encodedPath = encodeAll(opts.path);

  // 3. 参数: 按参数名 ASCII 升序, 值做二次 URL 编码
  let encodedParams = "";
  if (opts.params) {
    const sorted = Object.entries(opts.params).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    encodedParams = sorted
      .map(([k, v]) => `${encodeAll(k)}=${encodeAll(encodeAll(v))}`)
      .join("&");
  }

  // 4 & 5. header 部分
  const nonceLine = `x-api-nonce:${nonce}`;
  const timestampLine = `x-api-timestamp:${timestamp}`;

  // 拼接签名明文（末尾有换行符）
  const plaintext = `${methodUpper}\n${encodedPath}\n${encodedParams}\n${nonceLine}\n${timestampLine}\n`;

  const signature = hmacSha256Base64(opts.clientSecret, plaintext);

  return { signature, nonce, timestamp };
}
