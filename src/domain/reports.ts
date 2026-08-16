import type { RepositoryListItem } from "./repository";

const DAY_MS = 24 * 60 * 60 * 1_000;

export type RankMovement = {
  repository: RepositoryListItem;
  places: number;
  direction: "UP" | "DOWN";
};

export type EcosystemReportSnapshot = {
  ecosystemKey: string;
  ecosystemName: string;
  observedAt: Date;
  repositoryCount: number;
  scoredRepositoryCount: number;
  totalStars: number;
  averageScore: number | null;
  averageMomentum: number | null;
};

export type EcosystemMovement = {
  ecosystemKey: string;
  ecosystemName: string;
  latestObservedAt: Date;
  baselineObservedAt: Date;
  historySpanDays: number;
  repositoryCount: number;
  scoredRepositoryCount: number;
  starGrowth: number;
  starGrowthPercent: number | null;
  averageScoreChange: number | null;
  averageMomentumChange: number | null;
};

export function rankRepositoryMovers(
  repositories: RepositoryListItem[],
  limit = 10,
): RankMovement[] {
  return repositories
    .flatMap((repository): RankMovement[] => {
      if (repository.rank === null || repository.previousRank === null) return [];
      const places = repository.previousRank - repository.rank;
      if (places === 0) return [];
      return [
        {
          repository,
          places: Math.abs(places),
          direction: places > 0 ? "UP" : "DOWN",
        },
      ];
    })
    .sort(
      (left, right) =>
        right.places - left.places ||
        (left.direction === right.direction ? 0 : left.direction === "UP" ? -1 : 1) ||
        left.repository.fullName.localeCompare(right.repository.fullName),
    )
    .slice(0, Math.max(0, limit));
}

export function selectNewObservedRepositories(
  repositories: RepositoryListItem[],
  windowDays: number,
  asOf = new Date(),
  limit = 10,
): RepositoryListItem[] {
  const cutoff = asOf.getTime() - Math.max(1, windowDays) * DAY_MS;
  return repositories
    .filter(
      (repository) =>
        repository.discoveredAt.getTime() >= cutoff &&
        repository.discoveredAt <= asOf &&
        repository.observedAt !== null &&
        repository.state === "ACTIVE" &&
        repository.isFork !== true,
    )
    .sort(
      (left, right) =>
        right.discoveredAt.getTime() - left.discoveredAt.getTime() ||
        (right.score ?? -1) - (left.score ?? -1) ||
        left.fullName.localeCompare(right.fullName),
    )
    .slice(0, Math.max(0, limit));
}

export function calculateEcosystemMovements(
  snapshots: EcosystemReportSnapshot[],
  windowDays: number,
  asOf = new Date(),
  limit = 10,
): EcosystemMovement[] {
  const cutoff = asOf.getTime() - Math.max(1, windowDays) * DAY_MS;
  const grouped = new Map<string, EcosystemReportSnapshot[]>();
  for (const snapshot of snapshots) {
    if (snapshot.observedAt > asOf) continue;
    const values = grouped.get(snapshot.ecosystemKey) ?? [];
    values.push(snapshot);
    grouped.set(snapshot.ecosystemKey, values);
  }

  const movements: EcosystemMovement[] = [];
  for (const values of grouped.values()) {
    values.sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
    const latest = values.at(-1);
    const baseline = values.filter((snapshot) => snapshot.observedAt.getTime() <= cutoff).at(-1);
    if (!latest || !baseline || latest.observedAt <= baseline.observedAt) continue;
    const starGrowth = latest.totalStars - baseline.totalStars;
    if (starGrowth <= 0) continue;
    movements.push({
      ecosystemKey: latest.ecosystemKey,
      ecosystemName: latest.ecosystemName,
      latestObservedAt: latest.observedAt,
      baselineObservedAt: baseline.observedAt,
      historySpanDays:
        Math.round(((latest.observedAt.getTime() - baseline.observedAt.getTime()) / DAY_MS) * 10) /
        10,
      repositoryCount: latest.repositoryCount,
      scoredRepositoryCount: latest.scoredRepositoryCount,
      starGrowth,
      starGrowthPercent:
        baseline.totalStars <= 0
          ? null
          : Math.round((starGrowth / baseline.totalStars) * 10_000) / 100,
      averageScoreChange: nullableDifference(latest.averageScore, baseline.averageScore),
      averageMomentumChange: nullableDifference(latest.averageMomentum, baseline.averageMomentum),
    });
  }

  return movements
    .sort(
      (left, right) =>
        right.starGrowth - left.starGrowth || left.ecosystemName.localeCompare(right.ecosystemName),
    )
    .slice(0, Math.max(0, limit));
}

function nullableDifference(latest: number | null, baseline: number | null): number | null {
  if (latest === null || baseline === null) return null;
  return Math.round((latest - baseline) * 100) / 100;
}
