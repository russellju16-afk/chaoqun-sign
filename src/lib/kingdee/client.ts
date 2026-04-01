/**
 * Kingdee 云星辰 Open API — base HTTP client with OAuth2 token management.
 *
 * Token lifecycle:
 *   - Fetched on first authenticated call.
 *   - Cached in module scope (acceptable for serverless — process lifetime
 *     is short and a single warm token is reused across requests in the same
 *     invocation window).
 *   - Automatically refreshed if the cached token has expired (with a 60 s
 *     safety margin).
 *
 * Env vars required:
 *   KINGDEE_APP_ID       — OAuth2 client ID
 *   KINGDEE_APP_SECRET   — OAuth2 client secret
 *   KINGDEE_API_BASE     — base URL, e.g. "https://api.kingdee.com"
 *   KINGDEE_ACCOUNT_ID   — 账套 ID, passed in every API request header
 */

import type { KingdeeApiResponse, KingdeeTokenData } from "./types";

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

function getConfig() {
  return {
    appId: requireEnv("KINGDEE_APP_ID"),
    appSecret: requireEnv("KINGDEE_APP_SECRET"),
    apiBase: requireEnv("KINGDEE_API_BASE").replace(/\/$/, ""),
    accountId: requireEnv("KINGDEE_ACCOUNT_ID"),
  };
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

interface TokenCache {
  readonly accessToken: string;
  /** Epoch ms at which the token expires. */
  readonly expiresAt: number;
}

/** Module-level token cache. One per process/warm lambda instance. */
let tokenCache: TokenCache | null = null;

/** Safety margin (ms) before declared expiry at which we force a refresh. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

function isCacheValid(cache: TokenCache): boolean {
  return Date.now() < cache.expiresAt - TOKEN_EXPIRY_MARGIN_MS;
}

// ---------------------------------------------------------------------------
// Token fetch
// ---------------------------------------------------------------------------

async function fetchAccessToken(): Promise<TokenCache> {
  const { appId, appSecret, apiBase } = getConfig();

  const url = `${apiBase}/jdyconnector/app_management/api/oauth/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    app_id: appId,
    app_secret: appSecret,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(
      `[kingdee] Token request failed: ${response.status} ${response.statusText} — ${text}`,
    );
  }

  const json = (await response.json()) as KingdeeApiResponse<KingdeeTokenData>;

  if (json.code !== 0) {
    throw new Error(
      `[kingdee] Token API error (code=${json.code}): ${json.message}`,
    );
  }

  const expiresAt = Date.now() + json.data.expires_in * 1000;
  return { accessToken: json.data.access_token, expiresAt };
}

// ---------------------------------------------------------------------------
// Public: getAccessToken
// ---------------------------------------------------------------------------

/**
 * Returns a valid access token, fetching or refreshing as needed.
 * All callers share the module-level cache.
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache !== null && isCacheValid(tokenCache)) {
    return tokenCache.accessToken;
  }

  const fresh = await fetchAccessToken();
  tokenCache = fresh;
  return fresh.accessToken;
}

// ---------------------------------------------------------------------------
// Public: kingdeeRequest
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request to the Kingdee Open API.
 *
 * @param method  HTTP method ("GET" | "POST" | "PUT" | ...)
 * @param path    Path relative to apiBase, e.g. "/jdyconnector/..."
 * @param body    Optional JSON body (for POST/PUT requests)
 * @returns       The parsed `data` field from the Kingdee response envelope
 * @throws        On HTTP errors or non-zero Kingdee response codes
 */
export async function kingdeeRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { apiBase, accountId } = getConfig();
  const accessToken = await getAccessToken();

  const url = `${apiBase}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-KD-AccountId": accountId,
  };

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(url, init);

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(
      `[kingdee] API HTTP error: ${method} ${path} → ${response.status} ${response.statusText} — ${text}`,
    );
  }

  const json = (await response.json()) as KingdeeApiResponse<T>;

  if (json.code !== 0) {
    throw new Error(
      `[kingdee] API error (code=${json.code}) on ${method} ${path}: ${json.message}`,
    );
  }

  return json.data;
}
