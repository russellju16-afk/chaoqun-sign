import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

const APP_VERSION = process.env.npm_package_version ?? "0.1.0";
const START_TIME = Date.now();

type CheckStatus = "ok" | "degraded" | "down";

interface CheckResult {
  status: CheckStatus;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: CheckStatus;
  checks: {
    db: CheckResult;
    redis: CheckResult;
  };
  uptimeSeconds: number;
  version: string;
  timestamp: string;
}

const TIMEOUT_MS = 2000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} check timed out after ${timeoutMs}ms`)), timeoutMs),
  );
  return Promise.race([promise, timeout]);
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, TIMEOUT_MS, "db");
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const pong = await withTimeout(redis.ping(), TIMEOUT_MS, "redis");
    if (pong !== "PONG") {
      return { status: "degraded", latencyMs: Date.now() - start, error: `unexpected ping response: ${pong}` };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function aggregateStatus(checks: { db: CheckResult; redis: CheckResult }): CheckStatus {
  const statuses = [checks.db.status, checks.redis.status];
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const checks = { db, redis };
  const status = aggregateStatus(checks);

  const body: HealthResponse = {
    status,
    checks,
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  };

  const httpStatus = status === "ok" ? 200 : status === "degraded" ? 200 : 503;
  return NextResponse.json(body, { status: httpStatus });
}
