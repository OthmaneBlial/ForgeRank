import { asc, eq, inArray, sql } from "drizzle-orm";

import {
  decideRepositoryRefresh,
  type RefreshPolicyInput,
  type RefreshTier,
} from "@/domain/refresh-policy";
import type { Maturity, RepositoryState } from "@/domain/repository";
import { getDatabase } from "@/infrastructure/db/client";
import {
  collectionRepositories,
  crawlJobs,
  repositories,
  systemState,
} from "@/infrastructure/db/schema";
import { enqueueJob } from "@/infrastructure/queue/job-queue";

export type RefreshScheduleReport = {
  evaluated: number;
  due: number;
  selected: number;
  queued: number;
  alreadyQueued: number;
  tiers: Record<RefreshTier, number>;
  generatedAt: Date;
};

const numberOrNull = (value: string | null): number | null =>
  value === null ? null : Number(value);

export async function scheduleRepositoryRefreshes(
  options: {
    limit?: number;
    now?: Date;
  } = {},
): Promise<RefreshScheduleReport> {
  const database = await getDatabase();
  const now = options.now ?? new Date();
  const limit = Math.min(
    250,
    Math.max(1, options.limit ?? Number(process.env.REFRESH_SCHEDULE_BATCH_SIZE ?? 25)),
  );
  const [repositoryRows, membershipRows, activeJobRows] = await Promise.all([
    database.select().from(repositories).orderBy(asc(repositories.fullName)),
    database
      .select({
        repositoryId: collectionRepositories.repositoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(collectionRepositories)
      .groupBy(collectionRepositories.repositoryId),
    database
      .select({ deduplicationKey: crawlJobs.deduplicationKey })
      .from(crawlJobs)
      .where(inArray(crawlJobs.status, ["QUEUED", "RUNNING"])),
  ]);
  const memberships = new Map(membershipRows.map((row) => [row.repositoryId, row.count]));
  const activeJobs = new Set(activeJobRows.map((row) => row.deduplicationKey));
  const tiers: Record<RefreshTier, number> = { HOT: 0, ACTIVE: 0, NORMAL: 0, COLD: 0 };
  const decisions = repositoryRows.map((repository) => {
    const input: RefreshPolicyInput = {
      state: repository.state as RepositoryState,
      maturity: repository.maturity as Maturity | null,
      stars: repository.currentStars,
      momentum: numberOrNull(repository.currentMomentumScore),
      lastActivityAt: repository.lastActivityAt,
      lastSuccessfulFetchAt: repository.lastSuccessfulFetchAt,
      lastRefreshCompletedAt: repository.lastIndexedAt,
      collectionCount: memberships.get(repository.id) ?? 0,
      pageViewCount: repository.pageViewCount,
      lastViewedAt: repository.lastViewedAt,
      refreshRequestCount: repository.refreshRequestCount,
      lastRefreshRequestedAt: repository.lastRefreshRequestedAt,
    };
    return { repository, decision: decideRepositoryRefresh(input, now) };
  });

  await database.transaction(async (transaction) => {
    for (const { repository, decision } of decisions) {
      tiers[decision.tier] += 1;
      await transaction
        .update(repositories)
        .set({ refreshTier: decision.tier, nextRefreshAt: decision.nextRefreshAt })
        .where(eq(repositories.id, repository.id));
    }
  });

  const dueDecisions = decisions
    .filter(({ decision }) => decision.due)
    .sort(
      (left, right) =>
        right.decision.priority - left.decision.priority ||
        left.repository.fullName.localeCompare(right.repository.fullName),
    );
  const eligible = dueDecisions.filter(
    ({ repository }) =>
      !activeJobs.has(`refresh_repository_metadata:${repository.fullName.toLowerCase()}`),
  );
  const due = eligible.slice(0, limit);
  let queued = 0;
  for (const { repository, decision } of due) {
    const inserted = await enqueueJob({
      type: "take_repository_snapshot",
      deduplicationKey: `refresh_repository_metadata:${repository.fullName.toLowerCase()}`,
      payload: {
        repositoryId: repository.id,
        fullName: repository.fullName,
        refreshTier: decision.tier,
        priorityReasons: decision.reasons,
      },
      priority: decision.priority,
      maxAttempts: 3,
    });
    if (inserted) queued += 1;
  }
  if (queued > 0) {
    await enqueueJob({
      type: "refresh_rankings",
      deduplicationKey: "refresh_rankings:repository:global",
      payload: { trigger: "scheduled_repository_refresh" },
      priority: 1,
      maxAttempts: 2,
    });
  }

  const report: RefreshScheduleReport = {
    evaluated: decisions.length,
    due: dueDecisions.length,
    selected: due.length,
    queued,
    alreadyQueued: dueDecisions.length - eligible.length + due.length - queued,
    tiers,
    generatedAt: now,
  };
  await database
    .insert(systemState)
    .values({
      key: "last_repository_refresh_schedule",
      value: { ...report, generatedAt: now.toISOString() },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemState.key,
      set: { value: { ...report, generatedAt: now.toISOString() }, updatedAt: now },
    });
  return report;
}
