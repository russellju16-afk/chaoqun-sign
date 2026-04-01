import { Queue } from "bullmq";
import { redis } from "@/lib/redis";
import type { PrintJobData } from "./types";

/**
 * BullMQ Queue for print jobs.
 *
 * We reuse the existing ioredis singleton rather than creating a second
 * connection. BullMQ accepts a raw ioredis instance via the `connection` option.
 */
export const printQueue = new Queue<PrintJobData>("print-jobs", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000, // 2 s → 4 s → 8 s
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Enqueue a print job and return the resulting BullMQ Job object.
 * The job id is set to the PrintJob DB record id so duplicates are detectable.
 */
export async function enqueuePrintJob(data: PrintJobData): Promise<void> {
  await printQueue.add("print", data, {
    jobId: data.printJobId, // idempotency: same printJobId won't be added twice
  });
}
