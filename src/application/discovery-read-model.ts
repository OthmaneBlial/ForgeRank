import { asc, desc, inArray } from "drizzle-orm";

import {
  rankDiscoveryCandidates,
  type DiscoveryCandidateInput,
  type DiscoveryMode,
} from "@/domain/discovery";
import { getDatabase } from "@/infrastructure/db/client";
import { gitAnalyses, repositorySnapshots } from "@/infrastructure/db/schema";
import { listRepositories } from "@/infrastructure/db/repository-store";

export async function getDiscoveryRankings(mode: DiscoveryMode, periodDays = 7, limit = 40) {
  const candidates = await loadDiscoveryCandidates();
  return rankDiscoveryCandidates(candidates, mode, normalizePeriod(periodDays)).slice(
    0,
    Math.min(100, Math.max(1, limit)),
  );
}

export async function getDiscoveryPageReadModel() {
  const [candidates, recent] = await Promise.all([
    loadDiscoveryCandidates(),
    listRepositories({ sort: "recent", limit: 12, onlyIndexed: false }),
  ]);
  return {
    recent,
    gems: rankDiscoveryCandidates(candidates, "gems", 30).slice(0, 6),
    rising: rankDiscoveryCandidates(candidates, "rising", 7).slice(0, 6),
    revived: rankDiscoveryCandidates(
      candidates.filter((candidate) => candidate.repository.maturity === "REVIVED"),
      "active",
      30,
    ).slice(0, 6),
    surprisePool: rankDiscoveryCandidates(candidates, "trending", 30).slice(0, 30),
  };
}

export async function getHomeDiscoveryReadModel() {
  const candidates = await loadDiscoveryCandidates();
  return {
    trending: rankDiscoveryCandidates(candidates, "trending", 7).slice(0, 10),
    gems: rankDiscoveryCandidates(candidates, "gems", 30).slice(0, 6),
  };
}

export async function loadDiscoveryCandidates(): Promise<DiscoveryCandidateInput[]> {
  const repositories = await listRepositories({ sort: "score", limit: 100 });
  if (repositories.length === 0) return [];
  const database = await getDatabase();
  const repositoryIds = repositories.map((repository) => repository.id);
  const [snapshots, analyses] = await Promise.all([
    database
      .select({
        repositoryId: repositorySnapshots.repositoryId,
        observedAt: repositorySnapshots.observedAt,
        stars: repositorySnapshots.stars,
        forks: repositorySnapshots.forks,
        forgeScore: repositorySnapshots.forgeScore,
      })
      .from(repositorySnapshots)
      .where(inArray(repositorySnapshots.repositoryId, repositoryIds))
      .orderBy(asc(repositorySnapshots.observedAt)),
    database
      .selectDistinctOn([gitAnalyses.repositoryId], {
        repositoryId: gitAnalyses.repositoryId,
        commits90d: gitAnalyses.commits90d,
        activeWeeks12: gitAnalyses.activeWeeks12,
        uniqueAuthors90d: gitAnalyses.uniqueAuthors90d,
      })
      .from(gitAnalyses)
      .where(andRecentAnalysis(repositoryIds))
      .orderBy(gitAnalyses.repositoryId, desc(gitAnalyses.analyzedAt)),
  ]);
  const snapshotsByRepository = new Map<string, DiscoveryCandidateInput["snapshots"]>();
  for (const snapshot of snapshots) {
    if (snapshot.stars === null) continue;
    const values = snapshotsByRepository.get(snapshot.repositoryId) ?? [];
    values.push({
      observedAt: snapshot.observedAt,
      stars: snapshot.stars,
      forks: snapshot.forks,
      forgeScore: snapshot.forgeScore === null ? null : Number(snapshot.forgeScore),
    });
    snapshotsByRepository.set(snapshot.repositoryId, values);
  }
  const analysisByRepository = new Map(
    analyses.map((analysis) => [analysis.repositoryId, analysis]),
  );
  return repositories.map((repository) => {
    const analysis = analysisByRepository.get(repository.id);
    return {
      repository,
      snapshots: snapshotsByRepository.get(repository.id) ?? [],
      commits90d: analysis?.commits90d ?? null,
      activeWeeks12: analysis?.activeWeeks12 ?? null,
      uniqueAuthors90d: analysis?.uniqueAuthors90d ?? null,
    };
  });
}

function normalizePeriod(periodDays: number): number {
  return [1, 7, 30].includes(periodDays) ? periodDays : 7;
}

function andRecentAnalysis(repositoryIds: string[]) {
  return inArray(gitAnalyses.repositoryId, repositoryIds);
}
