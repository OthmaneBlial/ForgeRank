export type ComparableSnapshot = { observedAt: Date; stars: number | null };

export type ComparableGrowth = {
  repositoryId: string;
  absoluteGrowth: number | null;
  percentageGrowth: number | null;
  observations: number;
};

export type ComparableGrowthResult = {
  window: { start: Date; end: Date } | null;
  repositories: ComparableGrowth[];
};

export type EcosystemRepositoryEvidence = {
  id: string;
  ecosystem: string | null;
  fullName: string;
  stars: number | null;
  score: number | null;
  health: number | null;
  community: number | null;
  engineering: number | null;
  momentum: number | null;
  commits90d: number | null;
  activeWeeks12: number | null;
  uniqueAuthors90d: number | null;
};

export type EcosystemComparisonEntry = {
  name: string;
  repositoryCount: number;
  scoredRepositoryCount: number;
  gitAnalyzedRepositoryCount: number;
  activeRepositoryCount: number;
  totalStars: number;
  totalCommits90d: number | null;
  averageScore: number | null;
  averageHealth: number | null;
  averageCommunity: number | null;
  averageEngineering: number | null;
  averageMomentum: number | null;
  averageActiveWeeks12: number | null;
  averageAuthors90d: number | null;
  topRepositories: Array<{
    id: string;
    fullName: string;
    score: number | null;
    stars: number | null;
  }>;
};

export function calculateComparableGrowth(
  snapshotsByRepository: Map<string, ComparableSnapshot[]>,
): ComparableGrowthResult {
  const ordered = [...snapshotsByRepository.entries()].map(([repositoryId, snapshots]) => ({
    repositoryId,
    snapshots: [...snapshots]
      .filter((snapshot) => snapshot.stars !== null)
      .sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime()),
  }));
  if (ordered.length < 2 || ordered.some((entry) => entry.snapshots.length < 2))
    return emptyResult(ordered);
  const starts = ordered
    .map((entry) => entry.snapshots[0]?.observedAt)
    .filter((value): value is Date => value !== undefined);
  const ends = ordered
    .map((entry) => entry.snapshots.at(-1)?.observedAt)
    .filter((value): value is Date => value !== undefined);
  const start = new Date(Math.max(...starts.map((value) => value.getTime())));
  const end = new Date(Math.min(...ends.map((value) => value.getTime())));
  if (start >= end) return emptyResult(ordered);

  const repositories = ordered.map(({ repositoryId, snapshots }) => {
    const inside = snapshots.filter(
      (snapshot) => snapshot.observedAt >= start && snapshot.observedAt <= end,
    );
    const first = inside.at(0);
    const last = inside.at(-1);
    if (!first || !last || inside.length < 2 || first.stars === null || last.stars === null) {
      return {
        repositoryId,
        absoluteGrowth: null,
        percentageGrowth: null,
        observations: inside.length,
      };
    }
    const absoluteGrowth = last.stars - first.stars;
    if (absoluteGrowth < 0)
      return {
        repositoryId,
        absoluteGrowth: null,
        percentageGrowth: null,
        observations: inside.length,
      };
    return {
      repositoryId,
      absoluteGrowth,
      percentageGrowth: Math.round((absoluteGrowth / Math.max(1, first.stars)) * 10_000) / 100,
      observations: inside.length,
    };
  });
  if (repositories.some((repository) => repository.absoluteGrowth === null))
    return { window: null, repositories };
  return { window: { start, end }, repositories };
}

export function aggregateEcosystems(
  ecosystems: string[],
  evidence: EcosystemRepositoryEvidence[],
): EcosystemComparisonEntry[] {
  return ecosystems.map((name) => {
    const repositories = evidence.filter(
      (repository) => repository.ecosystem?.toLowerCase() === name.toLowerCase(),
    );
    const analyzed = repositories.filter(
      (repository) =>
        repository.commits90d !== null ||
        repository.activeWeeks12 !== null ||
        repository.uniqueAuthors90d !== null,
    );
    return {
      name,
      repositoryCount: repositories.length,
      scoredRepositoryCount: repositories.filter((repository) => repository.score !== null).length,
      gitAnalyzedRepositoryCount: analyzed.length,
      activeRepositoryCount: analyzed.filter(
        (repository) => (repository.commits90d ?? 0) > 0 || (repository.activeWeeks12 ?? 0) > 0,
      ).length,
      totalStars: repositories.reduce((total, repository) => total + (repository.stars ?? 0), 0),
      totalCommits90d: sumOrNull(repositories.map((repository) => repository.commits90d)),
      averageScore: average(repositories.map((repository) => repository.score)),
      averageHealth: average(repositories.map((repository) => repository.health)),
      averageCommunity: average(repositories.map((repository) => repository.community)),
      averageEngineering: average(repositories.map((repository) => repository.engineering)),
      averageMomentum: average(repositories.map((repository) => repository.momentum)),
      averageActiveWeeks12: average(repositories.map((repository) => repository.activeWeeks12)),
      averageAuthors90d: average(repositories.map((repository) => repository.uniqueAuthors90d)),
      topRepositories: repositories
        .toSorted(
          (left, right) =>
            (right.score ?? -1) - (left.score ?? -1) ||
            (right.stars ?? -1) - (left.stars ?? -1) ||
            left.fullName.localeCompare(right.fullName),
        )
        .slice(0, 3)
        .map(({ id, fullName, score, stars }) => ({ id, fullName, score, stars })),
    };
  });
}

export function ecosystemSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("+", " plus ")
    .replaceAll("#", " sharp ")
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function emptyResult(
  ordered: Array<{ repositoryId: string; snapshots: ComparableSnapshot[] }>,
): ComparableGrowthResult {
  return {
    window: null,
    repositories: ordered.map((entry) => ({
      repositoryId: entry.repositoryId,
      absoluteGrowth: null,
      percentageGrowth: null,
      observations: entry.snapshots.length,
    })),
  };
}

function average(values: Array<number | null>): number | null {
  const available = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (available.length === 0) return null;
  return (
    Math.round((available.reduce((total, value) => total + value, 0) / available.length) * 10) / 10
  );
}

function sumOrNull(values: Array<number | null>): number | null {
  const available = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return available.length === 0 ? null : available.reduce((total, value) => total + value, 0);
}
