import { asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { rankingSnapshots, repositories } from "@/infrastructure/db/schema";
import { takeLanguageEcosystemSnapshots } from "@/application/take-ecosystem-snapshots";

export const RANKING_VERSION = "repository-ranking-v1";

export async function refreshRepositoryRankings(): Promise<number> {
  const database = await getDatabase();
  const ranked = await database
    .select({
      id: repositories.id,
      previousRank: repositories.rank,
      score: repositories.currentScore,
    })
    .from(repositories)
    .where(isNotNull(repositories.currentScore))
    .orderBy(desc(repositories.currentScore), asc(repositories.fullName));

  const calculatedAt = new Date();
  await database.transaction(async (transaction) => {
    await transaction
      .update(repositories)
      .set({ previousRank: sql`${repositories.rank}`, rank: null });
    for (const [index, repository] of ranked.entries()) {
      const rank = index + 1;
      await transaction
        .update(repositories)
        .set({ previousRank: repository.previousRank, rank })
        .where(eq(repositories.id, repository.id));
      await transaction.insert(rankingSnapshots).values({
        scope: "global",
        period: "all",
        repositoryId: repository.id,
        rank,
        score: repository.score ?? "0",
        calculatedAt,
        rankingVersion: RANKING_VERSION,
      });
    }
    await transaction
      .insert((await import("@/infrastructure/db/schema")).systemState)
      .values({
        key: "last_repository_ranking",
        value: {
          calculatedAt: calculatedAt.toISOString(),
          count: ranked.length,
          version: RANKING_VERSION,
        },
      })
      .onConflictDoUpdate({
        target: (await import("@/infrastructure/db/schema")).systemState.key,
        set: {
          value: {
            calculatedAt: calculatedAt.toISOString(),
            count: ranked.length,
            version: RANKING_VERSION,
          },
          updatedAt: sql`now()`,
        },
      });
  });

  await takeLanguageEcosystemSnapshots(calculatedAt);

  return ranked.length;
}
