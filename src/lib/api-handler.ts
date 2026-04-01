import { NextRequest, NextResponse } from "next/server";
import type { RateLimitResult } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A rate-limiter factory: receives the current request and returns a
 * RateLimitResult (or a Promise thereof).  Keeping it as a factory lets
 * callers decide which key to extract (IP, token, phone, …).
 */
type RateLimiter = (
  req: NextRequest,
) => Promise<RateLimitResult> | RateLimitResult;

export interface ApiHandlerOptions {
  /** When provided, rate-limit the route before calling the handler. */
  readonly rateLimiter?: RateLimiter;
}

/**
 * A typed route handler: receives a NextRequest and returns a NextResponse
 * (or a Promise thereof).  The generic parameter captures the response body
 * type so callers keep type inference.
 */
type RouteHandler<T> = (req: NextRequest) => Promise<NextResponse<T>>;

// ---------------------------------------------------------------------------
// Structured error body (mirrors src/lib/errors.ts)
// ---------------------------------------------------------------------------

interface ErrorBody {
  readonly error: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// withApiHandler
// ---------------------------------------------------------------------------

/**
 * Wraps a Next.js App Router route handler with:
 *   - Automatic error catching → structured JSON error responses
 *   - Optional rate limiting (429 when limit exceeded)
 *   - Request context logging on errors
 *
 * Usage:
 *   export const GET = withApiHandler(async (req) => { … }, { rateLimiter: apiRateLimit });
 */
export function withApiHandler<T>(
  handler: RouteHandler<T>,
  options: ApiHandlerOptions = {},
): RouteHandler<T | ErrorBody> {
  return async (req: NextRequest): Promise<NextResponse<T | ErrorBody>> => {
    // -----------------------------------------------------------------------
    // Rate limiting (optional)
    // -----------------------------------------------------------------------
    if (options.rateLimiter) {
      let rlResult: RateLimitResult;
      try {
        rlResult = await options.rateLimiter(req);
      } catch (rlErr) {
        // Redis unavailable — log and fall through (fail open)
        console.error("[api-handler] rate-limiter error, skipping:", rlErr);
        rlResult = { success: true, remaining: -1, resetAt: new Date() };
      }

      if (!rlResult.success) {
        const headers = buildRateLimitHeaders(rlResult);
        return NextResponse.json<ErrorBody>(
          { error: "TOO_MANY_REQUESTS", message: "请求过于频繁，请稍后重试" },
          { status: 429, headers },
        );
      }
    }

    // -----------------------------------------------------------------------
    // Handler execution
    // -----------------------------------------------------------------------
    try {
      return await handler(req);
    } catch (err: unknown) {
      const context = buildRequestContext(req);
      console.error("[api-handler] unhandled error", context, err);

      // Distinguish known operational errors from unexpected ones
      if (err instanceof ApiError) {
        return NextResponse.json<ErrorBody>(
          { error: err.code, message: err.message },
          { status: err.status },
        );
      }

      return NextResponse.json<ErrorBody>(
        { error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误" },
        { status: 500 },
      );
    }
  };
}

// ---------------------------------------------------------------------------
// ApiError — throw from handlers to produce structured responses
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  static badRequest(message = "请求参数错误"): ApiError {
    return new ApiError("BAD_REQUEST", message, 400);
  }

  static unauthorized(message = "未登录或会话已过期"): ApiError {
    return new ApiError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "权限不足"): ApiError {
    return new ApiError("FORBIDDEN", message, 403);
  }

  static notFound(message = "资源不存在"): ApiError {
    return new ApiError("NOT_FOUND", message, 404);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
    "Retry-After": String(
      Math.max(
        0,
        Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
      ),
    ),
  };
}

function buildRequestContext(req: NextRequest): Record<string, string> {
  return {
    method: req.method,
    pathname: req.nextUrl.pathname,
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };
}
