/**
 * Order number generator.
 * Produces sequential numbers in the format CQ-YYYYMMDD-NNN.
 * NNN is padded to 3 digits (001 – 999) and resets each calendar day (Asia/Shanghai).
 */

import { prisma } from "@/lib/db";

/** Return today's date string in Asia/Shanghai timezone as YYYYMMDD. */
function todayDateString(): string {
  return new Date()
    .toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, ""); // "2024/01/05" → "20240105"
}

/**
 * Generate the next sequential order number for today.
 * Queries the DB for the highest existing sequence for today, then increments.
 *
 * Retries up to 5 times on unique-constraint race conditions (two concurrent
 * requests both seeing the same max and racing to insert the same order_no).
 */
export async function generateOrderNo(): Promise<string> {
  const prefix = `CQ-${todayDateString()}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.deliveryOrder.findFirst({
      where: { orderNo: { startsWith: prefix } },
      orderBy: { orderNo: "desc" },
      select: { orderNo: true },
    });

    let nextSeq = 1;
    if (last) {
      const parts = last.orderNo.split("-");
      const lastSeq = parseInt(parts[parts.length - 1] ?? "0", 10);
      if (!Number.isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    if (nextSeq > 999) {
      throw new Error(
        `Daily order number limit (999) reached for prefix ${prefix}`,
      );
    }

    const orderNo = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    // Optimistic check — caller will insert; if unique constraint fires the
    // calling transaction will throw and we retry with a freshly computed seq.
    const existing = await prisma.deliveryOrder.findUnique({
      where: { orderNo },
      select: { id: true },
    });

    if (!existing) {
      return orderNo;
    }

    // Another concurrent request already used this number — loop to recompute.
  }

  throw new Error(
    "Failed to generate a unique order number after 5 attempts; too many concurrent requests.",
  );
}
