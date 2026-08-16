import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { crawlFailures, crawlJobs } from "@/infrastructure/db/schema";

export type CrawlJob = typeof crawlJobs.$inferSelect;

const STALE_LOCK_MS = 15 * 60 * 1_000;

export async function enqueueJob(input: {
  type: string;
  deduplicationKey: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
}): Promise<boolean> {
  const database = await getDatabase();
  const inserted = await database
    .insert(crawlJobs)
    .values({
      type: input.type,
      deduplicationKey: input.deduplicationKey,
      payload: input.payload,
      priority: input.priority ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
    })
    .onConflictDoNothing()
    .returning({ id: crawlJobs.id });
  if (inserted.length === 0) {
    await database
      .update(crawlJobs)
      .set({
        priority: sql`greatest(${crawlJobs.priority}, ${input.priority ?? 0})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crawlJobs.deduplicationKey, input.deduplicationKey),
          inArray(crawlJobs.status, ["QUEUED", "RUNNING"]),
        ),
      );
  }
  return inserted.length > 0;
}

export async function claimNextJob(workerId: string): Promise<CrawlJob | null> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    const staleJobs = await transaction
      .select()
      .from(crawlJobs)
      .where(
        and(
          eq(crawlJobs.status, "RUNNING"),
          lte(crawlJobs.lockedAt, new Date(Date.now() - STALE_LOCK_MS)),
        ),
      )
      .for("update", { skipLocked: true });
    for (const stale of staleJobs) {
      if (stale.attempts >= stale.maxAttempts) {
        await transaction.insert(crawlFailures).values({
          jobId: stale.id,
          source: "worker_recovery",
          errorCode: "STALE_JOB_LOCK",
          message: "A worker stopped while holding this job and its attempt budget is exhausted.",
          retryable: false,
        });
        await transaction
          .update(crawlJobs)
          .set({
            status: "FAILED",
            lockedAt: null,
            lockedBy: null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(crawlJobs.id, stale.id));
      } else {
        await transaction
          .update(crawlJobs)
          .set({
            status: "QUEUED",
            availableAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(crawlJobs.id, stale.id));
      }
    }
    const [job] = await transaction
      .select()
      .from(crawlJobs)
      .where(and(eq(crawlJobs.status, "QUEUED"), lte(crawlJobs.availableAt, new Date())))
      .orderBy(desc(crawlJobs.priority), asc(crawlJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;
    const [claimed] = await transaction
      .update(crawlJobs)
      .set({
        status: "RUNNING",
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: job.attempts + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(crawlJobs.id, job.id), eq(crawlJobs.status, "QUEUED")))
      .returning();
    return claimed ?? null;
  });
}

export async function completeJob(jobId: string): Promise<void> {
  const database = await getDatabase();
  await database
    .update(crawlJobs)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(crawlJobs.id, jobId));
}

export async function failJob(
  job: CrawlJob,
  error: { code: string; message: string; retryable: boolean; repositoryId?: string },
): Promise<void> {
  const database = await getDatabase();
  const retry = error.retryable && job.attempts < job.maxAttempts;
  const backoffMs = Math.min(60 * 60 * 1_000, 30_000 * 2 ** Math.max(0, job.attempts - 1));
  await database.transaction(async (transaction) => {
    await transaction.insert(crawlFailures).values({
      jobId: job.id,
      repositoryId: error.repositoryId,
      source: job.type,
      errorCode: error.code,
      message: error.message.slice(0, 1_000),
      retryable: error.retryable,
    });
    await transaction
      .update(crawlJobs)
      .set({
        status: retry ? "QUEUED" : "FAILED",
        availableAt: retry ? new Date(Date.now() + backoffMs) : job.availableAt,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(crawlJobs.id, job.id));
  });
}
