import { and, eq, inArray, sql } from "drizzle-orm";

import { decideRepositoryRefresh, type RefreshPolicyInput } from "@/domain/refresh-policy";
import type { Maturity, RepositoryState } from "@/domain/repository";
import { getDatabase } from "@/infrastructure/db/client";
import { collectionRepositories, crawlJobs, repositories } from "@/infrastructure/db/schema";

export type RefreshRequestResult =
  | { status: "NOT_FOUND" }
  | {
      status: "QUEUED" | "ALREADY_PENDING" | "COOLDOWN";
      fullName: string;
      priority: number;
      nextEligibleAt: Date;
    };

export async function requestRepositoryRefresh(
  owner: string,
  name: string,
  now = new Date(),
): Promise<RefreshRequestResult> {
  const database = await getDatabase();
  const canonicalKey = `github.com/${owner}/${name}`.toLowerCase();
  const cooldownMs = Math.max(
    60_000,
    Number(process.env.REFRESH_REQUEST_COOLDOWN_MS ?? 15 * 60 * 1_000),
  );

  return database.transaction(async (transaction) => {
    const [repository] = await transaction
      .select()
      .from(repositories)
      .where(eq(repositories.canonicalKey, canonicalKey))
      .limit(1)
      .for("update");
    if (!repository) return { status: "NOT_FOUND" };

    const nextEligibleAt = repository.lastRefreshRequestedAt
      ? new Date(repository.lastRefreshRequestedAt.getTime() + cooldownMs)
      : now;
    if (nextEligibleAt > now) {
      return { status: "COOLDOWN", fullName: repository.fullName, priority: 0, nextEligibleAt };
    }

    const [membership] = await transaction
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionRepositories)
      .where(eq(collectionRepositories.repositoryId, repository.id));
    const refreshRequestCount = repository.refreshRequestCount + 1;
    const input: RefreshPolicyInput = {
      state: repository.state as RepositoryState,
      maturity: repository.maturity as Maturity | null,
      stars: repository.currentStars,
      momentum:
        repository.currentMomentumScore === null ? null : Number(repository.currentMomentumScore),
      lastActivityAt: repository.lastActivityAt,
      lastSuccessfulFetchAt: repository.lastSuccessfulFetchAt,
      lastRefreshCompletedAt: repository.lastIndexedAt,
      collectionCount: membership?.count ?? 0,
      pageViewCount: repository.pageViewCount,
      lastViewedAt: repository.lastViewedAt,
      refreshRequestCount,
      lastRefreshRequestedAt: now,
    };
    const decision = decideRepositoryRefresh(input, now);
    await transaction
      .update(repositories)
      .set({
        refreshTier: decision.tier,
        nextRefreshAt: now,
        lastRefreshRequestedAt: now,
        refreshRequestCount,
      })
      .where(eq(repositories.id, repository.id));

    const deduplicationKey = `refresh_repository_metadata:${repository.fullName.toLowerCase()}`;
    const inserted = await transaction
      .insert(crawlJobs)
      .values({
        type: "take_repository_snapshot",
        deduplicationKey,
        payload: {
          repositoryId: repository.id,
          fullName: repository.fullName,
          refreshTier: decision.tier,
          priorityReasons: decision.reasons,
          requestedByUser: true,
        },
        priority: decision.priority,
        maxAttempts: 3,
      })
      .onConflictDoNothing()
      .returning({ id: crawlJobs.id });
    await transaction
      .update(crawlJobs)
      .set({ priority: sql`greatest(${crawlJobs.priority}, ${decision.priority})`, updatedAt: now })
      .where(
        and(
          eq(crawlJobs.deduplicationKey, deduplicationKey),
          inArray(crawlJobs.status, ["QUEUED", "RUNNING"]),
        ),
      );
    return {
      status: inserted.length > 0 ? "QUEUED" : "ALREADY_PENDING",
      fullName: repository.fullName,
      priority: decision.priority,
      nextEligibleAt: new Date(now.getTime() + cooldownMs),
    };
  });
}
