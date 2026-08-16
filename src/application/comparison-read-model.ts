import { asc, desc, inArray, isNotNull } from "drizzle-orm";

import { aggregateEcosystems, calculateComparableGrowth, ecosystemSlug } from "@/domain/comparison";
import { formatObservationAge } from "@/domain/format";
import { getDatabase } from "@/infrastructure/db/client";
import { gitAnalyses, repositories, repositorySnapshots } from "@/infrastructure/db/schema";
import { getRepository, toListItem } from "@/infrastructure/db/repository-store";

export async function getRepositoryComparisonReadModel(rawIdentifiers: string[]) {
  const readAt = new Date();
  const identifiers = uniqueIdentifiers(rawIdentifiers).slice(0, 5);
  const requested = await Promise.all(
    identifiers.map(async (identifier) => {
      const [owner = "", name = ""] = identifier.split("/");
      try {
        return { identifier, repository: await getRepository(owner, name) };
      } catch {
        return { identifier, repository: null };
      }
    }),
  );
  const available = requested.flatMap((entry) =>
    entry.repository ? [{ identifier: entry.identifier, repository: entry.repository }] : [],
  );
  const repositoryIds = available.map((entry) => entry.repository.id);
  if (repositoryIds.length === 0)
    return {
      identifiers,
      entries: requested.map((entry) => ({
        ...entry,
        analysis: null,
        growth: null,
        freshnessLabel: "Awaiting first observation",
        ageDays: null,
      })),
      window: null,
      indexedUniverse: 0,
    };
  const database = await getDatabase();
  const [snapshots, analyses, indexedUniverse] = await Promise.all([
    database
      .select()
      .from(repositorySnapshots)
      .where(inArray(repositorySnapshots.repositoryId, repositoryIds))
      .orderBy(asc(repositorySnapshots.observedAt)),
    database
      .selectDistinctOn([gitAnalyses.repositoryId])
      .from(gitAnalyses)
      .where(inArray(gitAnalyses.repositoryId, repositoryIds))
      .orderBy(gitAnalyses.repositoryId, desc(gitAnalyses.analyzedAt)),
    database
      .select({ id: repositories.id })
      .from(repositories)
      .where(isNotNull(repositories.lastSuccessfulFetchAt)),
  ]);
  const snapshotsByRepository = new Map<
    string,
    Array<{ observedAt: Date; stars: number | null }>
  >();
  for (const snapshot of snapshots)
    snapshotsByRepository.set(snapshot.repositoryId, [
      ...(snapshotsByRepository.get(snapshot.repositoryId) ?? []),
      { observedAt: snapshot.observedAt, stars: snapshot.stars },
    ]);
  const comparable = calculateComparableGrowth(
    new Map(
      available.map((entry) => [
        entry.repository.id,
        snapshotsByRepository.get(entry.repository.id) ?? [],
      ]),
    ),
  );
  const growthByRepository = new Map(
    comparable.repositories.map((growth) => [growth.repositoryId, growth]),
  );
  const analysisByRepository = new Map(
    analyses.map((analysis) => [analysis.repositoryId, analysis]),
  );
  return {
    identifiers,
    window: comparable.window,
    indexedUniverse: indexedUniverse.length,
    entries: requested.map((entry) => ({
      ...entry,
      analysis: entry.repository ? (analysisByRepository.get(entry.repository.id) ?? null) : null,
      growth: entry.repository ? (growthByRepository.get(entry.repository.id) ?? null) : null,
      freshnessLabel: formatObservationAge(entry.repository?.observedAt ?? null),
      ageDays: entry.repository?.repositoryCreatedAt
        ? Math.max(
            0,
            Math.floor(
              (readAt.getTime() - entry.repository.repositoryCreatedAt.getTime()) /
                (24 * 60 * 60 * 1_000),
            ),
          )
        : null,
    })),
  };
}

export async function getEcosystemComparisonCandidates() {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(repositories)
    .where(isNotNull(repositories.lastSuccessfulFetchAt));
  return rows.map(toListItem);
}

export async function getEcosystemComparisonReadModel(rawSlugs: string[]) {
  const calculatedAt = new Date();
  const candidates = await getEcosystemComparisonCandidates();
  const counts = new Map<string, { name: string; count: number }>();
  for (const repository of candidates) {
    if (!repository.primaryLanguage) continue;
    const slug = ecosystemSlug(repository.primaryLanguage);
    const current = counts.get(slug);
    counts.set(slug, { name: repository.primaryLanguage, count: (current?.count ?? 0) + 1 });
  }
  const candidateEcosystems = [...counts.entries()]
    .map(([slug, value]) => ({ slug, ...value }))
    .toSorted((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const namesBySlug = new Map(
    candidateEcosystems.map((ecosystem) => [ecosystem.slug, ecosystem.name]),
  );
  const slugs = uniqueSlugs(rawSlugs).slice(0, 5);
  const names = slugs.map((slug) => namesBySlug.get(slug) ?? humanizeSlug(slug));
  const selectedNames = new Set(names.map((name) => name.toLowerCase()));
  const selectedRepositories = candidates.filter(
    (repository) =>
      repository.primaryLanguage && selectedNames.has(repository.primaryLanguage.toLowerCase()),
  );
  const database = await getDatabase();
  const repositoryIds = selectedRepositories.map((repository) => repository.id);
  const analyses =
    repositoryIds.length === 0
      ? []
      : await database
          .selectDistinctOn([gitAnalyses.repositoryId])
          .from(gitAnalyses)
          .where(inArray(gitAnalyses.repositoryId, repositoryIds))
          .orderBy(gitAnalyses.repositoryId, desc(gitAnalyses.analyzedAt));
  const analysisByRepository = new Map(
    analyses.map((analysis) => [analysis.repositoryId, analysis]),
  );
  const entries = aggregateEcosystems(
    names,
    selectedRepositories.map((repository) => {
      const analysis = analysisByRepository.get(repository.id);
      return {
        id: repository.id,
        ecosystem: repository.primaryLanguage,
        fullName: repository.fullName,
        stars: repository.stars,
        score: repository.score,
        health: repository.health,
        community: repository.community,
        engineering: repository.engineering,
        momentum: repository.momentum,
        commits90d: analysis?.commits90d ?? null,
        activeWeeks12: analysis?.activeWeeks12 ?? null,
        uniqueAuthors90d: analysis?.uniqueAuthors90d ?? null,
      };
    }),
  );
  return { slugs, entries, candidateEcosystems, indexedUniverse: candidates.length, calculatedAt };
}

function uniqueIdentifiers(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(value)) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function uniqueSlugs(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => {
      if (!/^[a-z0-9-]+$/.test(value) || value.length > 80 || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
