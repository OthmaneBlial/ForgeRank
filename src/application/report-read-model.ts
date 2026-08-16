import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { loadDiscoveryCandidates } from "@/application/discovery-read-model";
import { rankDiscoveryCandidates } from "@/domain/discovery";
import {
  calculateEcosystemMovements,
  rankRepositoryMovers,
  selectNewObservedRepositories,
  type EcosystemReportSnapshot,
} from "@/domain/reports";
import { getDatabase } from "@/infrastructure/db/client";
import { listDevelopers } from "@/infrastructure/db/developer-store";
import { ecosystemSnapshots, rankingSnapshots } from "@/infrastructure/db/schema";
import { countRepositories, listRepositories } from "@/infrastructure/db/repository-store";

const DAY_MS = 24 * 60 * 60 * 1_000;

export type ReportCoverage = {
  generatedAt: Date;
  latestObservationAt: Date | null;
  latestRankingAt: Date | null;
  identifiers: number;
  indexedRepositories: number;
  scoredRepositories: number;
  rankedRepositories: number;
  ecosystemSnapshotsInQuery: number;
};

export async function getDailyReportReadModel(asOf = new Date()) {
  const base = await loadReportBase(1, asOf);
  return {
    asOf,
    coverage: base.coverage,
    fastestRising: rankDiscoveryCandidates(base.candidates, "rising", 1, asOf).slice(0, 6),
    breakouts: rankDiscoveryCandidates(base.candidates, "breakout", 7, asOf).slice(0, 6),
    revived: rankDiscoveryCandidates(
      base.candidates.filter((candidate) => candidate.repository.maturity === "REVIVED"),
      "active",
      30,
      asOf,
    ).slice(0, 6),
    newRepositories: selectNewObservedRepositories(base.repositories, 1, asOf, 6),
    rankMovers: rankRepositoryMovers(base.repositories, 6),
    ecosystemGainers: calculateEcosystemMovements(base.ecosystemSnapshots, 1, asOf, 6),
  };
}

export async function getWeeklyReportReadModel(asOf = new Date()) {
  const base = await loadReportBase(7, asOf);
  const developers = await listDevelopers(10);
  return {
    asOf,
    coverage: base.coverage,
    topRepositories: base.repositories
      .filter((repository) => repository.rank !== null)
      .sort(
        (left, right) =>
          (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
          left.fullName.localeCompare(right.fullName),
      )
      .slice(0, 20),
    fastestRising: rankDiscoveryCandidates(base.candidates, "rising", 7, asOf).slice(0, 10),
    newRepositories: selectNewObservedRepositories(base.repositories, 7, asOf, 8),
    rankMovers: rankRepositoryMovers(base.repositories, 10),
    ecosystemGainers: calculateEcosystemMovements(base.ecosystemSnapshots, 7, asOf, 8),
    developerSpotlight: developers.find((developer) => developer.currentScore !== null) ?? null,
  };
}

async function loadReportBase(windowDays: number, asOf: Date) {
  const database = await getDatabase();
  const historyCutoff = new Date(asOf.getTime() - Math.max(35, windowDays + 14) * DAY_MS);
  const [candidates, repositoryRows, counts, snapshotRows, latestRanking] = await Promise.all([
    loadDiscoveryCandidates(),
    listRepositories({ sort: "score", onlyIndexed: false, limit: 100 }),
    countRepositories(),
    database
      .select()
      .from(ecosystemSnapshots)
      .where(
        and(
          eq(ecosystemSnapshots.ecosystemType, "LANGUAGE"),
          gte(ecosystemSnapshots.observedAt, historyCutoff),
          lte(ecosystemSnapshots.observedAt, asOf),
        ),
      )
      .orderBy(ecosystemSnapshots.ecosystemKey, ecosystemSnapshots.observedAt)
      .limit(2_000),
    database
      .select({ calculatedAt: rankingSnapshots.calculatedAt })
      .from(rankingSnapshots)
      .where(
        and(
          eq(rankingSnapshots.scope, "global"),
          eq(rankingSnapshots.period, "all"),
          lte(rankingSnapshots.calculatedAt, asOf),
        ),
      )
      .orderBy(desc(rankingSnapshots.calculatedAt))
      .limit(1),
  ]);
  const latestRankingAt = latestRanking[0]?.calculatedAt ?? null;
  const [rankingCount] = latestRankingAt
    ? await database
        .select({ count: sql<number>`count(*)::int` })
        .from(rankingSnapshots)
        .where(
          and(
            eq(rankingSnapshots.scope, "global"),
            eq(rankingSnapshots.period, "all"),
            eq(rankingSnapshots.calculatedAt, latestRankingAt),
          ),
        )
    : [{ count: 0 }];
  const latestObservationAt = repositoryRows.reduce<Date | null>(
    (latest, repository) =>
      repository.observedAt && (!latest || repository.observedAt > latest)
        ? repository.observedAt
        : latest,
    null,
  );
  const reportSnapshots: EcosystemReportSnapshot[] = snapshotRows.map((snapshot) => ({
    ecosystemKey: snapshot.ecosystemKey,
    ecosystemName: snapshot.ecosystemName,
    observedAt: snapshot.observedAt,
    repositoryCount: snapshot.repositoryCount,
    scoredRepositoryCount: snapshot.scoredRepositoryCount,
    totalStars: snapshot.totalStars,
    averageScore: snapshot.averageScore === null ? null : Number(snapshot.averageScore),
    averageMomentum: snapshot.averageMomentum === null ? null : Number(snapshot.averageMomentum),
  }));
  return {
    candidates,
    repositories: repositoryRows,
    ecosystemSnapshots: reportSnapshots,
    coverage: {
      generatedAt: asOf,
      latestObservationAt,
      latestRankingAt,
      identifiers: counts.total,
      indexedRepositories: counts.indexed,
      scoredRepositories: repositoryRows.filter((repository) => repository.score !== null).length,
      rankedRepositories: rankingCount?.count ?? 0,
      ecosystemSnapshotsInQuery: snapshotRows.length,
    } satisfies ReportCoverage,
  };
}
