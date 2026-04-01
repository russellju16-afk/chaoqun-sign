/**
 * Monitoring helpers — structured logging with Sentry-ready stubs.
 *
 * If SENTRY_DSN is set, initialize the Sentry SDK here.
 * Otherwise every capture falls back to structured console output.
 *
 * Usage:
 *   import { captureError, captureMessage } from "@/lib/monitoring";
 *   captureError(err, { userId, orderId });
 */

import type { NextRequest, NextResponse } from "next/server";

export type LogLevel = "debug" | "info" | "warning" | "error" | "fatal";

export interface ErrorContext {
  [key: string]: unknown;
}

interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: ErrorContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ---------------------------------------------------------------------------
// Sentry initialization (stub — install @sentry/nextjs to activate)
// ---------------------------------------------------------------------------

let sentryInitialized = false;

function initSentryIfConfigured(): void {
  if (sentryInitialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // When @sentry/nextjs is installed, uncomment and adjust:
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.init({
  //   dsn,
  //   environment: process.env.NODE_ENV ?? "production",
  //   tracesSampleRate: 0.1,
  // });

  sentryInitialized = true;
  console.info("[monitoring] Sentry DSN configured — install @sentry/nextjs to activate");
}

// Run once at module load
initSentryIfConfigured();

// ---------------------------------------------------------------------------
// Core capture functions
// ---------------------------------------------------------------------------

/**
 * Capture an error with optional structured context.
 * Logs to stderr as JSON; forwards to Sentry when configured.
 */
export function captureError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const log: StructuredLog = {
    level: "error",
    message: err.message,
    timestamp: new Date().toISOString(),
    context,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };

  console.error(JSON.stringify(log));

  // Sentry forward (uncomment when @sentry/nextjs installed):
  // if (process.env.SENTRY_DSN) {
  //   import("@sentry/nextjs").then(({ captureException }) => {
  //     captureException(err, { extra: context });
  //   });
  // }
}

/**
 * Capture a structured message at the given log level.
 */
export function captureMessage(
  message: string,
  level: LogLevel = "info",
  context?: ErrorContext,
): void {
  const log: StructuredLog = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (level === "error" || level === "fatal") {
    console.error(JSON.stringify(log));
  } else if (level === "warning") {
    console.warn(JSON.stringify(log));
  } else {
    console.info(JSON.stringify(log));
  }

  // Sentry forward (uncomment when @sentry/nextjs installed):
  // if (process.env.SENTRY_DSN) {
  //   import("@sentry/nextjs").then(({ captureMessage: sentryCapture }) => {
  //     sentryCapture(message, { level, extra: context });
  //   });
  // }
}

// ---------------------------------------------------------------------------
// API route middleware helper
// ---------------------------------------------------------------------------

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Wrap an API route handler so unhandled errors are captured before re-throwing.
 *
 * Usage:
 *   export const GET = withErrorCapture(async (req) => { ... });
 */
export function withErrorCapture(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (err) {
      captureError(err, {
        url: req.url,
        method: req.method,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
      throw err;
    }
  };
}
