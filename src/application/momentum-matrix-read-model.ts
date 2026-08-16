import { asc, eq, inArray } from "drizzle-orm";

import { loadDiscoveryCandidates } from "@/application/discovery-read-model";
import {
  filterMomentumMatrixPoints,
  type MomentumMatrixFilters,
  type MomentumMatrixPoint,
} from "@/domain/momentum-matrix";
import { calculateTrend, selectTrendWindowObservations } from "@/domain/trending";
import { getDatabase } from "@/infrastructure/db/client";
import { repositoryTopics, topics } from "@/infrastructure/db/schema";
import { countRepositories } from "@/infrastructure/db/repository-store";

const DAY_MS = 24 * 60 * 60 * 1_000;

export async function getMomentumMatrixReadModel(
  filters: MomentumMatrixFilters,
  asOf = new Date(),
) {
  const [candidates, indexCoverage] = await Promise.all([
    loadDiscoveryCandidates(),
    countRepositories(),
  ]);
  const repositoryIds = candidates.map((candidate) => candidate.repository.id);
  const database = await getDatabase();
  const topicRows =
    repositoryIds.length === 0
      ? []
      : await database
          .select({
            repositoryId: repositoryTopics.repositoryId,
            slug: topics.slug,
            name: topics.name,
          })
          .from(repositoryTopics)
          .innerJoin(topics, eq(topics.slug, repositoryTopics.topicSlug))
          .where(inArray(repositoryTopics.repositoryId, repositoryIds))
          .orderBy(asc(topics.name));

  const topicsByRepository = new Map<string, string[]>();
  for (const row of topicRows) {
    topicsByRepository.set(row.repositoryId, [
      ...(topicsByRepository.get(row.repositoryId) ?? []),
      row.slug,
    ]);
  }

  const points: MomentumMatrixPoint[] = candidates.map((candidate) => {
    const observations = selectTrendWindowObservations(candidate.snapshots, 30, asOf);
    const trend = calculateTrend(observations, 30);
    const first = observations.at(0)?.observedAt;
    const latest = observations.at(-1)?.observedAt;
    return {
      repository: candidate.repository,
      growth30d: trend.anomaly ? null : trend.absoluteGrowth,
      growthConfidence: trend.confidence,
      historySpanDays:
        first && latest ? Math.round(((latest.getTime() - first.getTime()) / DAY_MS) * 10) / 10 : 0,
      ageDays: candidate.repository.repositoryCreatedAt
        ? Math.max(
            0,
            Math.floor(
              (asOf.getTime() - candidate.repository.repositoryCreatedAt.getTime()) / DAY_MS,
            ),
          )
        : null,
      topicSlugs: topicsByRepository.get(candidate.repository.id) ?? [],
    };
  });
  const eligible = points.filter(
    (point) => point.repository.stars !== null && point.repository.momentum !== null,
  );
  const filtered = filterMomentumMatrixPoints(eligible, filters);
  const topicOptions = [
    ...new Map(topicRows.map((row) => [row.slug, { slug: row.slug, name: row.name }])).values(),
  ].toSorted((left, right) => left.name.localeCompare(right.name));

  return {
    points: filtered,
    options: {
      languages: [
        ...new Set(
          candidates
            .map((candidate) => candidate.repository.primaryLanguage)
            .filter((language): language is string => Boolean(language)),
        ),
      ].toSorted((left, right) => left.localeCompare(right)),
      topics: topicOptions,
    },
    coverage: {
      identifiers: indexCoverage.total,
      indexed: indexCoverage.indexed,
      boundedCandidates: candidates.length,
      momentumEligible: eligible.length,
      filtered: filtered.length,
      growthAvailable: filtered.filter((point) => point.growth30d !== null).length,
      generatedAt: asOf,
    },
  };
}
