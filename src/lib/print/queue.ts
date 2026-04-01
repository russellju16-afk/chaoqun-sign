import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis";
import type { PrintJobData } from "./types";

let _printQueue: Queue<PrintJobData> | undefined;

/**
 * Returns the BullMQ print-jobs Queue, creating it lazily on first access.
 * Deferred to avoid initialising the Redis connection at module-evaluation time
 * (which would crash the Next.js build when REDIS_URL is not set).
 */
function getPrintQueue(): Queue<PrintJobData> {
  if (!_printQueue) {
    _printQueue = new Queue<PrintJobData>("print-jobs", {
      connection: getRedis(),
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
  }
  return _printQueue;
}

/**
 * Enqueue a print job and return the resulting BullMQ Job object.
 * The job id is set to the PrintJob DB record id so duplicates are detectable.
 */
export async function enqueuePrintJob(data: PrintJobData): Promise<void> {
  await getPrintQueue().add("print", data, {
    jobId: data.printJobId, // idempotency: same printJobId won't be added twice
  });
}
