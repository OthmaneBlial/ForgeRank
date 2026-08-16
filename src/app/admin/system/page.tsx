import path from "node:path";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { desc, eq, gte, ne, sql } from "drizzle-orm";

import { PageHeader } from "@/components/shell/page-header";
import { Metric } from "@/components/data/metric";
import { getDatabase } from "@/infrastructure/db/client";
import { inspectDatabaseSize } from "@/infrastructure/db/size";
import {
  crawlFailures,
  crawlHostStates,
  crawlJobs,
  crawlRequestEvents,
  developers,
  ecosystemSnapshots,
  gitAnalyses,
  repositories,
  repositorySnapshots,
  sourceDocuments,
  systemState,
} from "@/infrastructure/db/schema";
import { inspectGitCache } from "@/infrastructure/git/cache-manager";
import { formatBytes } from "@/domain/format";
import { resolveOperatorAccessFromEnvironment } from "@/infrastructure/security/operator-access";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const requestHeaders = await headers();
  if (resolveOperatorAccessFromEnvironment(requestHeaders) !== "allowed") notFound();
  const database = await getDatabase();
  const cacheRoot =
    process.env.GIT_CACHE_DIR ??
    path.join(process.env.FORGERANK_DATA_DIR ?? path.join(process.cwd(), "data"), "git-cache");
  const [
    repoCount,
    developerCount,
    snapshotCount,
    ecosystemSnapshotCount,
    gitCount,
    queueCount,
    runningCount,
    failedCount,
    requestsHour,
    requestsDay,
    dueCount,
    refreshTiers,
    fetchHealth,
    recentFailures,
    recentSources,
    recentJobs,
    hostStates,
    rankingState,
    databaseBytes,
    gitCache,
  ] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(repositories),
    database.select({ count: sql<number>`count(*)::int` }).from(developers),
    database.select({ count: sql<number>`count(*)::int` }).from(repositorySnapshots),
    database.select({ count: sql<number>`count(*)::int` }).from(ecosystemSnapshots),
    database.select({ count: sql<number>`count(*)::int` }).from(gitAnalyses),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(crawlJobs)
      .where(eq(crawlJobs.status, "QUEUED")),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(crawlJobs)
      .where(eq(crawlJobs.status, "RUNNING")),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(crawlJobs)
      .where(eq(crawlJobs.status, "FAILED")),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(crawlRequestEvents)
      .where(gte(crawlRequestEvents.requestedAt, sql`now() - interval '1 hour'`)),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(crawlRequestEvents)
      .where(gte(crawlRequestEvents.requestedAt, sql`now() - interval '24 hours'`)),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(repositories)
      .where(sql`${repositories.nextRefreshAt} <= now()`),
    database
      .select({ tier: repositories.refreshTier, count: sql<number>`count(*)::int` })
      .from(repositories)
      .groupBy(repositories.refreshTier)
      .orderBy(repositories.refreshTier),
    database
      .select({
        total: sql<number>`count(*)::int`,
        successful: sql<number>`count(*) filter (where ${sourceDocuments.status} between 200 and 399)::int`,
      })
      .from(sourceDocuments)
      .where(gte(sourceDocuments.fetchedAt, sql`now() - interval '24 hours'`)),
    database.select().from(crawlFailures).orderBy(desc(crawlFailures.occurredAt)).limit(10),
    database.select().from(sourceDocuments).orderBy(desc(sourceDocuments.fetchedAt)).limit(10),
    database.select().from(crawlJobs).orderBy(desc(crawlJobs.updatedAt)).limit(10),
    database
      .select({
        host: crawlHostStates.host,
        lastRequestAt: crawlHostStates.lastRequestAt,
        consecutiveFailures: crawlHostStates.consecutiveFailures,
        openedUntil: crawlHostStates.openedUntil,
        circuitOpen: sql<boolean>`coalesce(${crawlHostStates.openedUntil} > now(), false)`,
      })
      .from(crawlHostStates)
      .where(ne(crawlHostStates.host, "__global__"))
      .orderBy(desc(crawlHostStates.updatedAt))
      .limit(10),
    database
      .select()
      .from(systemState)
      .where(eq(systemState.key, "last_repository_ranking"))
      .limit(1),
    inspectDatabaseSize(),
    inspectGitCache(cacheRoot),
  ]);
  const fetchRate = fetchHealth[0]?.total
    ? Math.round((fetchHealth[0].successful / fetchHealth[0].total) * 100)
    : null;
  return (
    <>
      <PageHeader
        eyebrow="Protected operations / not public"
        title="ForgeRank system"
        description="Queue, parser, Git inspection, request policy, and snapshot health for authorized operators."
      />
      <section className="shell content-section">
        <div className="coverage-grid">
          <Metric label="Repositories" value={String(repoCount[0]?.count ?? 0)} />
          <Metric label="Developers" value={String(developerCount[0]?.count ?? 0)} />
          <Metric label="Repository snapshots" value={String(snapshotCount[0]?.count ?? 0)} />
          <Metric
            label="Ecosystem snapshots"
            value={String(ecosystemSnapshotCount[0]?.count ?? 0)}
          />
          <Metric label="Git analyses" value={String(gitCount[0]?.count ?? 0)} />
          <Metric
            label="Queued jobs"
            value={String(queueCount[0]?.count ?? 0)}
            detail={`${runningCount[0]?.count ?? 0} running · ${dueCount[0]?.count ?? 0} refreshes due`}
          />
          <Metric label="Failed jobs" value={String(failedCount[0]?.count ?? 0)} />
          <Metric
            label="Fetch success / 24h"
            value={fetchRate === null ? "No requests" : `${fetchRate}%`}
            detail={`${fetchHealth[0]?.successful ?? 0}/${fetchHealth[0]?.total ?? 0} source documents`}
          />
          <Metric
            label="Request budget"
            value={`${requestsHour[0]?.count ?? 0} / 1h`}
            detail={`${requestsDay[0]?.count ?? 0} / 24h`}
          />
          <Metric label="Database size" value={formatBytes(databaseBytes)} />
          <Metric
            label="Git cache"
            value={formatBytes(gitCache.bytes)}
            detail={`${gitCache.repositories} repositories`}
          />
          <Metric
            label="Last ranking"
            value={rankingState[0]?.updatedAt?.toLocaleDateString("en") ?? "Never"}
            detail={rankingState[0]?.updatedAt?.toLocaleTimeString("en")}
          />
          <Metric
            label="Refresh tiers"
            value={
              refreshTiers.map((tier) => `${tier.tier[0]}:${tier.count}`).join(" · ") || "None"
            }
            detail="Hot · Active · Normal · Cold"
          />
        </div>
        <div className="ops-grid">
          <section>
            <h2>Recent jobs</h2>
            {recentJobs.length === 0 ? (
              <p>No jobs recorded.</p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id}>
                  <span>
                    {job.updatedAt.toLocaleString("en")} · priority {job.priority}
                  </span>
                  <strong>{job.type}</strong>
                  <small>
                    {job.status.toLowerCase()} · attempts {job.attempts}/{job.maxAttempts}
                  </small>
                </div>
              ))
            )}
          </section>
          <section>
            <h2>Recent source documents</h2>
            {recentSources.map((source) => (
              <div key={source.id}>
                <span>{source.fetchedAt.toLocaleString("en")}</span>
                <strong>
                  {source.status} {source.sourceUrl}
                </strong>
                <small>
                  {source.durationMs}ms /{" "}
                  {source.cacheHit ? "cache hit" : (source.parserVersion ?? "unparsed")}
                </small>
              </div>
            ))}
          </section>
          <section>
            <h2>Request policy</h2>
            {hostStates.length === 0 ? (
              <p>No persistent host state yet.</p>
            ) : (
              hostStates.map((state) => (
                <div key={state.host}>
                  <span>{state.host}</span>
                  <strong>
                    {state.circuitOpen
                      ? `Circuit open until ${state.openedUntil?.toLocaleString("en")}`
                      : "Circuit closed"}
                  </strong>
                  <small>
                    {state.consecutiveFailures} consecutive failures · last request{" "}
                    {state.lastRequestAt?.toLocaleString("en") ?? "none"}
                  </small>
                </div>
              ))
            )}
          </section>
          <section>
            <h2>Recent failures</h2>
            {recentFailures.length === 0 ? (
              <p>No recorded crawl failures.</p>
            ) : (
              recentFailures.map((failure) => (
                <div key={failure.id}>
                  <span>{failure.occurredAt.toLocaleString("en")}</span>
                  <strong>{failure.errorCode}</strong>
                  <small>{failure.message}</small>
                </div>
              ))
            )}
          </section>
        </div>
      </section>
    </>
  );
}
