#!/usr/bin/env node
/**
 * Cleanup cron script
 *
 * Runs all scheduled maintenance tasks:
 *   - Expired sign tokens (nulled out, not deleted)
 *   - Old audit logs (>90 days by default)
 *   - Failed print jobs (>30 days by default)
 *
 * Recommended cron entry (runs at 03:00 every day):
 *   0 3 * * * cd /app && node scripts/cleanup-cron.js
 *
 * The compiled output lives at scripts/cleanup-cron.js after `pnpm build`
 * (or run directly with Bun: `bun scripts/cleanup-cron.ts`).
 */

import {
  cleanupExpiredTokens,
  cleanupOldAuditLogs,
  cleanupFailedPrintJobs,
} from "../src/lib/cleanup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  const ts = new Date().toISOString();
  console.log(`[cleanup-cron] ${ts} ${message}`);
}

function logError(message: string, err: unknown): void {
  const ts = new Date().toISOString();
  console.error(`[cleanup-cron] ${ts} ERROR ${message}`, err);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  log("Starting cleanup run");

  // 1. Expired sign tokens
  try {
    const tokensResult = await cleanupExpiredTokens();
    log(`cleanupExpiredTokens: nulled ${tokensResult.deleted} token(s)`);
  } catch (err) {
    logError("cleanupExpiredTokens failed", err);
  }

  // 2. Old audit logs
  try {
    const auditResult = await cleanupOldAuditLogs();
    log(`cleanupOldAuditLogs: deleted ${auditResult.deleted} log(s)`);
  } catch (err) {
    logError("cleanupOldAuditLogs failed", err);
  }

  // 3. Failed print jobs
  try {
    const printResult = await cleanupFailedPrintJobs();
    log(`cleanupFailedPrintJobs: deleted ${printResult.deleted} job(s)`);
  } catch (err) {
    logError("cleanupFailedPrintJobs failed", err);
  }

  log("Cleanup run complete");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logError("Unhandled error in cleanup run", err);
    process.exit(1);
  });
