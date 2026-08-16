import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { closeDatabase } from "@/infrastructure/db/client";
import { logger } from "@/infrastructure/observability/logger";
import {
  pruneWorkerHeartbeats,
  recordWorkerHeartbeat,
  removeWorkerHeartbeat,
} from "@/infrastructure/observability/worker-health";
import { claimNextJob, completeJob, enqueueJob, failJob } from "@/infrastructure/queue/job-queue";
import { normalizeJobError, processJob } from "./process-job";

const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
const once = process.argv.includes("--once");
let stopping = false;
let activeJobId: string | undefined;
const schedulerIntervalMs = Math.max(
  60_000,
  Number(process.env.REFRESH_SCHEDULER_INTERVAL_MS ?? 15 * 60 * 1_000),
);
let nextScheduleAt = 0;
let nextSnapshotMaintenanceAt = 0;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function run(): Promise<void> {
  logger.info("worker_started", { worker_id: workerId, mode: once ? "once" : "continuous" });
  await pruneWorkerHeartbeats();
  await recordWorkerHeartbeat({ workerId, status: "RUNNING" });
  let heartbeatPending = false;
  const heartbeat = setInterval(() => {
    if (heartbeatPending) return;
    heartbeatPending = true;
    recordWorkerHeartbeat({ workerId, status: "RUNNING", activeJobId })
      .catch((error: unknown) => {
        logger.warn("worker_heartbeat_failed", {
          worker_id: workerId,
          error: error instanceof Error ? error.message : "Unknown heartbeat failure",
        });
      })
      .finally(() => {
        heartbeatPending = false;
      });
  }, 20_000);

  try {
    do {
      if (!once && Date.now() >= nextScheduleAt) {
        await enqueueJob({
          type: "schedule_repository_refreshes",
          deduplicationKey: "schedule_repository_refreshes:global",
          payload: {},
          priority: 105,
          maxAttempts: 2,
        });
        nextScheduleAt = Date.now() + schedulerIntervalMs;
      }
      if (!once && Date.now() >= nextSnapshotMaintenanceAt) {
        await enqueueJob({
          type: "maintain_snapshots",
          deduplicationKey: "maintain_snapshots:global",
          payload: {},
          priority: -20,
          maxAttempts: 1,
        });
        nextSnapshotMaintenanceAt = Date.now() + 24 * 60 * 60 * 1_000;
      }
      const job = await claimNextJob(workerId);
      if (!job) {
        if (once) break;
        await delay(2_000);
        continue;
      }
      activeJobId = job.id;
      const startedAt = performance.now();
      logger.info("job_started", {
        worker_id: workerId,
        job_id: job.id,
        status: "RUNNING",
        retry_count: job.attempts - 1,
        job_type: job.type,
      });
      try {
        await processJob(job);
        await completeJob(job.id);
        logger.info("job_completed", {
          worker_id: workerId,
          job_id: job.id,
          status: "COMPLETED",
          duration_ms: Math.round(performance.now() - startedAt),
          job_type: job.type,
        });
      } catch (error) {
        const normalized = normalizeJobError(error);
        await failJob(job, normalized);
        logger.error("job_failed", {
          worker_id: workerId,
          job_id: job.id,
          status: "FAILED",
          duration_ms: Math.round(performance.now() - startedAt),
          retry_count: job.attempts,
          error_code: normalized.code,
          retryable: normalized.retryable,
          job_type: job.type,
        });
      } finally {
        activeJobId = undefined;
      }
    } while (!stopping);
  } finally {
    clearInterval(heartbeat);
    await recordWorkerHeartbeat({ workerId, status: "STOPPING", activeJobId });
    await removeWorkerHeartbeat(workerId);
    logger.info("worker_stopped", { worker_id: workerId });
  }
}

run()
  .catch((error: unknown) => {
    logger.error("worker_crashed", {
      worker_id: workerId,
      error: error instanceof Error ? error.message : "Unknown failure",
    });
    process.exitCode = 1;
  })
  .finally(closeDatabase);
