import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface CleanupResult {
  readonly deleted: number;
}

// ---------------------------------------------------------------------------
// cleanupExpiredTokens
//
// Null out sign tokens that expired more than 7 days ago.
// We do not delete the orders — only the token fields.
// ---------------------------------------------------------------------------

export async function cleanupExpiredTokens(): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.deliveryOrder.updateMany({
    where: {
      signTokenExpiry: { lt: cutoff },
      signToken: { not: null },
    },
    data: {
      signToken: null,
      signTokenExpiry: null,
    },
  });

  return { deleted: result.count };
}

// ---------------------------------------------------------------------------
// cleanupOldAuditLogs
//
// Hard-delete audit logs older than N days (default 90).
// ---------------------------------------------------------------------------

export async function cleanupOldAuditLogs(
  daysToKeep = 90,
): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deleted: result.count };
}

// ---------------------------------------------------------------------------
// cleanupFailedPrintJobs
//
// Hard-delete FAILED print jobs older than N days (default 30).
// ---------------------------------------------------------------------------

export async function cleanupFailedPrintJobs(
  daysToKeep = 30,
): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  const result = await prisma.printJob.deleteMany({
    where: {
      status: "FAILED",
      createdAt: { lt: cutoff },
    },
  });

  return { deleted: result.count };
}
