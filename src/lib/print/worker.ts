import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/db";
import { generateDeliveryNoteHtml } from "./template";
import type { PrintJobData, OrderWithItems } from "./types";

// ── Printer stub ───────────────────────────────────────────────────────────────

/**
 * Stub: send rendered HTML/content to the named printer.
 *
 * Replace with real CUPS/IPP integration when the hardware layer is available.
 * The function receives the HTML string and all job parameters so the real
 * implementation has everything it needs.
 */
async function sendToPrinter(
  printerName: string,
  copies: number,
  html: string,
): Promise<void> {
  // TODO: integrate with CUPS via `lp`, `node-cups`, or an IPP client
  console.log(
    `[print-worker] stub: sending ${html.length} chars to printer="${printerName}" copies=${copies}`,
  );
}

// ── DB fetch helper ────────────────────────────────────────────────────────────

async function fetchOrder(orderId: string): Promise<OrderWithItems> {
  const row = await prisma.deliveryOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      kdBillNo: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      totalAmount: true,
      deliveryDate: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          spec: true,
          unit: true,
          quantity: true,
          unitPrice: true,
          amount: true,
        },
      },
    },
  });

  // Prisma returns Decimal for quantity — convert to string for the template
  return {
    ...row,
    items: row.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
    })),
  };
}

// ── Worker ─────────────────────────────────────────────────────────────────────

/**
 * BullMQ Worker that processes print jobs.
 *
 * Lifecycle:
 *   1. Fetch order + items from DB
 *   2. Generate HTML delivery note
 *   3. Mark PrintJob as PRINTING
 *   4. Send to printer stub
 *   5. Mark PrintJob as COMPLETED
 *
 * On any error the PrintJob is marked FAILED and the error message is stored.
 * BullMQ will retry up to 3 times with exponential backoff (configured on the
 * Queue) before the job is moved to the failed set.
 */
export const printWorker = new Worker<PrintJobData>(
  "print-jobs",
  async (job) => {
    const { printJobId, orderId, printerName, copies, format } = job.data;

    try {
      // 1. Fetch order
      const order = await fetchOrder(orderId);

      // 2. Generate HTML
      const html = generateDeliveryNoteHtml(order, format);

      // 3. Mark as PRINTING
      await prisma.printJob.update({
        where: { id: printJobId },
        data: { status: "PRINTING" },
      });

      // 4. Send to printer (stub)
      await sendToPrinter(printerName, copies, html);

      // 5. Mark as COMPLETED
      await prisma.printJob.update({
        where: { id: printJobId },
        data: { status: "COMPLETED" },
      });

      console.log(
        `[print-worker] job=${job.id} printJobId=${printJobId} completed`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error during printing";

      // Persist failure so the UI can surface the reason
      await prisma.printJob
        .update({
          where: { id: printJobId },
          data: { status: "FAILED", error: message },
        })
        .catch((updateErr: unknown) => {
          // Don't swallow the update error — log it but let the original propagate
          console.error(
            "[print-worker] failed to mark PrintJob as FAILED:",
            updateErr,
          );
        });

      throw err; // re-throw so BullMQ can retry / move to failed set
    }
  },
  {
    connection: redis,
    concurrency: 2, // process up to 2 print jobs in parallel
  },
);

printWorker.on("failed", (job, err) => {
  console.error(
    `[print-worker] job=${job?.id ?? "unknown"} permanently failed:`,
    err,
  );
});
