import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { ecosystemSlug } from "@/domain/comparison";
import { getDatabase } from "@/infrastructure/db/client";
import { ecosystemSnapshots, gitAnalyses, repositories } from "@/infrastructure/db/schema";

export const ECOSYSTEM_SNAPSHOT_VERSION = "language-ecosystem-v1";

export async function takeLanguageEcosystemSnapshots(
  observedAt = new Date(),
): Promise<{ observedAt: Date; ecosystems: number }> {
  const database = await getDatabase();
  const latestGit = database
    .selectDistinctOn([gitAnalyses.repositoryId], {
      repositoryId: gitAnalyses.repositoryId,
      commits90d: gitAnalyses.commits90d,
    })
    .from(gitAnalyses)
    .orderBy(gitAnalyses.repositoryId, desc(gitAnalyses.analyzedAt))
    .as("latest_ecosystem_git");
  const rows = await database
    .select({
      name: repositories.primaryLanguage,
      repositoryCount: sql<number>`count(*)::int`,
      scoredRepositoryCount: sql<number>`count(${repositories.currentScore})::int`,
      gitAnalyzedRepositoryCount: sql<number>`count(${latestGit.repositoryId})::int`,
      activeRepositoryCount90d: sql<number>`count(*) filter (where ${latestGit.commits90d} > 0)::int`,
      totalStars: sql<number>`coalesce(sum(${repositories.currentStars}), 0)::bigint`,
      totalCommits90d: sql<number | null>`sum(${latestGit.commits90d})::bigint`,
      averageScore: sql<string | null>`round(avg(${repositories.currentScore})::numeric, 2)`,
      averageMomentum: sql<
        string | null
      >`round(avg(${repositories.currentMomentumScore})::numeric, 2)`,
    })
    .from(repositories)
    .leftJoin(latestGit, eq(latestGit.repositoryId, repositories.id))
    .where(
      and(isNotNull(repositories.lastSuccessfulFetchAt), isNotNull(repositories.primaryLanguage)),
    )
    .groupBy(repositories.primaryLanguage)
    .orderBy(repositories.primaryLanguage);
  if (rows.length === 0) return { observedAt, ecosystems: 0 };
  await database
    .insert(ecosystemSnapshots)
    .values(
      rows.flatMap((row) =>
        row.name
          ? [
              {
                ecosystemType: "LANGUAGE",
                ecosystemKey: ecosystemSlug(row.name),
                ecosystemName: row.name,
                observedAt,
                repositoryCount: row.repositoryCount,
                scoredRepositoryCount: row.scoredRepositoryCount,
                gitAnalyzedRepositoryCount: row.gitAnalyzedRepositoryCount,
                activeRepositoryCount90d: row.activeRepositoryCount90d,
                totalStars: row.totalStars,
                totalCommits90d: row.totalCommits90d,
                averageScore: row.averageScore,
                averageMomentum: row.averageMomentum,
                snapshotVersion: ECOSYSTEM_SNAPSHOT_VERSION,
              },
            ]
          : [],
      ),
    )
    .onConflictDoNothing();
  return { observedAt, ecosystems: rows.length };
}
