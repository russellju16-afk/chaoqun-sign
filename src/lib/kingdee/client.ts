/**
 * Kingdee 云星辰 Open API — base HTTP client with app-token 管理。
 *
 * 认证流程（严格遵循金蝶官方文档）:
 *   1. 用 client_id + client_secret + app_key + app_signature 换取 app-token
 *   2. 每次 API 请求携带 app-token + X-Api-Signature 签名头
 *   3. app-token 24h 有效，提前 1h 自动刷新
 *
 * Env vars required:
 *   KINGDEE_CLIENT_ID      — 开放平台 Client ID
 *   KINGDEE_CLIENT_SECRET   — 开放平台 Client Secret
 *   KINGDEE_APP_KEY         — 应用 key（授权安装后获得）
 *   KINGDEE_APP_SECRET      — 应用 secret（24h 刷新）
 *   KINGDEE_GW_ROUTER_ADDR  — 网关路由地址（IDC 域名，如 https://tf.jdy.com）
 *
 * Optional:
 *   KINGDEE_BASE_URL — 业务 API base，默认 https://api.kingdee.com/jdy/v2
 *   KINGDEE_AUTH_URL — token 端点，默认 https://api.kingdee.com/jdyconnector/app_management/kingdee_auth_token
 */

import { buildAppSignature, buildApiSignature } from "./auth";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[kingdee] Missing required environment variable: ${name}`);
  }
  return value;
}

interface KingdeeConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly appKey: string;
  readonly appSecret: string;
  readonly baseUrl: string;
  readonly authUrl: string;
  readonly gwRouterAddr: string;
}

function getConfig(): KingdeeConfig {
  return {
    clientId: requireEnv("KINGDEE_CLIENT_ID"),
    clientSecret: requireEnv("KINGDEE_CLIENT_SECRET"),
    appKey: requireEnv("KINGDEE_APP_KEY"),
    appSecret: requireEnv("KINGDEE_APP_SECRET"),
    baseUrl: (
      process.env.KINGDEE_BASE_URL ?? "https://api.kingdee.com/jdy/v2"
    ).replace(/\/$/, ""),
    authUrl:
      process.env.KINGDEE_AUTH_URL ??
      "https://api.kingdee.com/jdyconnector/app_management/kingdee_auth_token",
    gwRouterAddr: process.env.KINGDEE_GW_ROUTER_ADDR ?? "",
  };
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

interface TokenCache {
  readonly appToken: string;
  readonly obtainedAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

/** app-token 有效期 24 小时，提前 1 小时刷新。 */
const TOKEN_TTL_MS = 24 * 3600 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 3600 * 1000;

/** 防并发刷新：正在进行中的 token 请求 Promise，避免多个请求同时触发 fetchAppToken。 */
let pendingTokenRefresh: Promise<string> | null = null;

function isCacheValid(cache: TokenCache): boolean {
  return Date.now() - cache.obtainedAt < TOKEN_TTL_MS - TOKEN_REFRESH_BUFFER_MS;
}

// ---------------------------------------------------------------------------
// Token fetch
// ---------------------------------------------------------------------------

async function fetchAppToken(): Promise<TokenCache> {
  const config = getConfig();
  const appSig = buildAppSignature(config.appKey, config.appSecret);

  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("app_signature", appSig);

  const response = await fetch(url.toString(), { method: "GET" });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(
      `[kingdee] Token request failed: ${response.status} ${response.statusText} — ${text}`,
    );
  }

  const json = (await response.json()) as {
    errcode: number;
    description?: string;
    description_cn?: string;
    data?: { "app-token": string; access_token?: string; uid?: string };
  };

  if (json.errcode !== 0 || !json.data) {
    throw new Error(
      `[kingdee] Token error (errcode=${json.errcode}): ${json.description ?? json.description_cn ?? "unknown"}`,
    );
  }

  return {
    appToken: json.data["app-token"],
    obtainedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Public: getAppToken
// ---------------------------------------------------------------------------

export async function getAppToken(): Promise<string> {
  // 缓存命中：直接返回，无需网络请求
  if (tokenCache !== null && isCacheValid(tokenCache)) {
    return tokenCache.appToken;
  }

  // 已有正在进行的刷新请求：复用同一个 Promise，避免并发踩踏
  if (pendingTokenRefresh !== null) {
    return pendingTokenRefresh;
  }

  // 发起新的刷新请求，并在完成后清除 pending 标记
  pendingTokenRefresh = fetchAppToken()
    .then((fresh) => {
      tokenCache = fresh;
      return fresh.appToken;
    })
    .finally(() => {
      pendingTokenRefresh = null;
    });

  return pendingTokenRefresh;
}

// ---------------------------------------------------------------------------
// Public: kingdeeRequest
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request to the Kingdee JDY v2 API.
 *
 * Every request carries:
 * - app-token header
 * - X-Api-Signature + X-Api-Nonce + X-Api-TimeStamp headers
 * - X-GW-Router-Addr header (if configured)
 *
 * @param method HTTP method (GET / POST / DELETE)
 * @param path   Path relative to baseUrl, e.g. "/scm/sal_out_bound"
 * @param opts   Optional body (POST) and/or query params (GET)
 * @returns      The `data` field from the Kingdee response envelope
 */
export async function kingdeeRequest<T>(
  method: string,
  path: string,
  opts?: {
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  },
): Promise<T> {
  const config = getConfig();
  const appToken = await getAppToken();

  // Build full URL
  const fullUrl = new URL(`${config.baseUrl}${path}`);
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      fullUrl.searchParams.set(k, v);
    }
  }

  // Signature path = baseUrl path + API path
  // e.g. "/jdy/v2" + "/scm/sal_out_bound" = "/jdy/v2/scm/sal_out_bound"
  const baseUrlObj = new URL(config.baseUrl);
  const sigPath = `${baseUrlObj.pathname.replace(/\/$/, "")}${path}`;

  const sig = buildApiSignature({
    method: method.toUpperCase(),
    path: sigPath,
    params: opts?.params ?? null,
    clientSecret: config.clientSecret,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-ClientID": config.clientId,
    "X-Api-Auth-Version": "2.0",
    "X-Api-TimeStamp": sig.timestamp,
    "X-Api-SignHeaders": "X-Api-TimeStamp,X-Api-Nonce",
    "X-Api-Nonce": sig.nonce,
    "X-Api-Signature": sig.signature,
    "app-token": appToken,
  };

  if (config.gwRouterAddr) {
    headers["X-GW-Router-Addr"] = config.gwRouterAddr;
  }

  const init: RequestInit = {
    method: method.toUpperCase(),
    headers,
    ...(opts?.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  };

  const response = await fetch(fullUrl.toString(), init);

  let result: {
    errcode?: number;
    description?: string;
    description_cn?: string;
    data?: T;
  };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new Error(
      `[kingdee] API HTTP error: ${method} ${path} → ${response.status} — unable to parse response`,
    );
  }

  const errcode = result.errcode ?? 0;
  if (response.status !== 200 || errcode !== 0) {
    throw new Error(
      `[kingdee] API error (errcode=${errcode}) on ${method} ${path}: ${result.description ?? result.description_cn ?? "unknown"}`,
    );
  }

  return (result.data ?? result) as T;
}
