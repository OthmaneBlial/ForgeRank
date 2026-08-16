import { confidenceFromObservations, type Confidence } from "./confidence";
import type { Maturity } from "./repository";

export const REPOSITORY_LEADERBOARD_SORTS = [
  "score",
  "stars",
  "growth",
  "forks",
  "activity",
  "community",
  "momentum",
  "health",
  "new-rising",
  "recent",
] as const;
export type RepositoryLeaderboardSort = (typeof REPOSITORY_LEADERBOARD_SORTS)[number];

export const REPOSITORY_LEADERBOARD_PERIODS = ["1d", "7d", "30d", "90d", "1y", "all"] as const;
export type RepositoryLeaderboardPeriod = (typeof REPOSITORY_LEADERBOARD_PERIODS)[number];

export const REPOSITORY_STAR_BANDS = [
  "all",
  "under-1k",
  "1k-5k",
  "5k-10k",
  "10k-50k",
  "50k-100k",
  "100k-plus",
] as const;
export type RepositoryStarBand = (typeof REPOSITORY_STAR_BANDS)[number];

export const REPOSITORY_AGE_FILTERS = ["all", "new", "under-1", "1-3", "3-5", "5-plus"] as const;
export type RepositoryAgeFilter = (typeof REPOSITORY_AGE_FILTERS)[number];

export const REPOSITORY_STATUS_FILTERS = ["all", "active", "stable", "slowing", "dormant"] as const;
export type RepositoryStatusFilter = (typeof REPOSITORY_STATUS_FILTERS)[number];

export type RepositoryLeaderboardRequest = {
  query?: string;
  language?: string;
  sort: RepositoryLeaderboardSort;
  period: RepositoryLeaderboardPeriod;
  stars: RepositoryStarBand;
  age: RepositoryAgeFilter;
  status: RepositoryStatusFilter;
  includeForks: boolean;
  page: number;
};

export type RepositoryLeaderboardGrowth = {
  absolute: number | null;
  confidence: Confidence;
  observationCount: number;
  historySpanDays: number;
  anomaly: string | null;
};

export const REPOSITORY_PERIOD_DAYS: Record<RepositoryLeaderboardPeriod, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: null,
};

export function normalizeRepositoryLeaderboardRequest(
  params: Record<string, string | string[] | undefined>,
): RepositoryLeaderboardRequest {
  const query = safeText(params.q, 100);
  const language = safeText(params.language, 40, /^[a-z0-9+#. _-]+$/i);
  return {
    query,
    language: language === "all" ? undefined : language,
    sort: member(params.sort, REPOSITORY_LEADERBOARD_SORTS, "score"),
    period: member(params.period, REPOSITORY_LEADERBOARD_PERIODS, "7d"),
    stars: member(params.stars, REPOSITORY_STAR_BANDS, "all"),
    age: member(params.age, REPOSITORY_AGE_FILTERS, "all"),
    status: member(params.status, REPOSITORY_STATUS_FILTERS, "all"),
    includeForks: params.forks === "include",
    page: integer(params.page, 1, 10_000, 1),
  };
}

export function repositoryStarRange(band: RepositoryStarBand): {
  minimum?: number;
  maximumExclusive?: number;
} {
  return {
    all: {},
    "under-1k": { minimum: 0, maximumExclusive: 1_000 },
    "1k-5k": { minimum: 1_000, maximumExclusive: 5_000 },
    "5k-10k": { minimum: 5_000, maximumExclusive: 10_000 },
    "10k-50k": { minimum: 10_000, maximumExclusive: 50_000 },
    "50k-100k": { minimum: 50_000, maximumExclusive: 100_000 },
    "100k-plus": { minimum: 100_000 },
  }[band];
}

export function repositoryAgeRange(filter: RepositoryAgeFilter): {
  minimumDays?: number;
  maximumDaysExclusive?: number;
} {
  return {
    all: {},
    new: { minimumDays: 0, maximumDaysExclusive: 90 },
    "under-1": { minimumDays: 0, maximumDaysExclusive: 365 },
    "1-3": { minimumDays: 365, maximumDaysExclusive: 3 * 365 },
    "3-5": { minimumDays: 3 * 365, maximumDaysExclusive: 5 * 365 },
    "5-plus": { minimumDays: 5 * 365 },
  }[filter];
}

export function repositoryStatusMaturities(filter: RepositoryStatusFilter): Maturity[] | null {
  if (filter === "all") return null;
  if (filter === "active") return ["NEW", "EMERGING", "GROWING", "REVIVED"];
  if (filter === "stable") return ["ESTABLISHED", "MATURE"];
  return filter === "slowing" ? ["SLOWING"] : ["DORMANT"];
}

export function calculateRepositoryLeaderboardGrowth(
  observations: Array<{ observedAt: Date; stars: number | null }>,
  period: RepositoryLeaderboardPeriod,
  asOf = new Date(),
): RepositoryLeaderboardGrowth {
  const ordered = observations
    .filter(
      (observation): observation is { observedAt: Date; stars: number } =>
        observation.stars !== null &&
        Number.isFinite(observation.stars) &&
        observation.stars >= 0 &&
        Number.isFinite(observation.observedAt.getTime()) &&
        observation.observedAt <= asOf,
    )
    .toSorted((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
  const latest = ordered.at(-1);
  const periodDays = REPOSITORY_PERIOD_DAYS[period];
  let baseline = ordered.at(0);

  if (periodDays !== null) {
    const cutoff = asOf.getTime() - periodDays * DAY_MS;
    const earliestAcceptedBaseline = cutoff - periodDays * DAY_MS;
    baseline = ordered
      .filter(
        (observation) =>
          observation.observedAt.getTime() <= cutoff &&
          observation.observedAt.getTime() >= earliestAcceptedBaseline,
      )
      .at(-1);
    if (!latest || latest.observedAt.getTime() < cutoff) baseline = undefined;
  }

  if (!baseline || !latest || baseline === latest) return unavailableGrowth();
  const used = ordered.filter(
    (observation) =>
      observation.observedAt >= baseline.observedAt && observation.observedAt <= latest.observedAt,
  );
  const absolute = latest.stars - baseline.stars;
  const historySpanDays = roundDays(latest.observedAt.getTime() - baseline.observedAt.getTime());
  if (absolute < 0) {
    return {
      absolute: null,
      confidence: "LOW",
      observationCount: used.length,
      historySpanDays,
      anomaly: "Observed star count decreased; the measurement requires review.",
    };
  }
  return {
    absolute,
    confidence: confidenceFromObservations(used.length, periodDays ?? 3),
    observationCount: used.length,
    historySpanDays,
    anomaly: null,
  };
}

function member<const T extends readonly string[]>(
  value: string | string[] | undefined,
  values: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && values.includes(value) ? value : fallback;
}

function safeText(
  value: string | string[] | undefined,
  maximumLength: number,
  pattern?: RegExp,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maximumLength);
  return normalized && (!pattern || pattern.test(normalized)) ? normalized : undefined;
}

function integer(
  value: string | string[] | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function unavailableGrowth(): RepositoryLeaderboardGrowth {
  return {
    absolute: null,
    confidence: "INSUFFICIENT",
    observationCount: 0,
    historySpanDays: 0,
    anomaly: null,
  };
}

function roundDays(milliseconds: number): number {
  return Math.round((milliseconds / DAY_MS) * 10) / 10;
}

const DAY_MS = 24 * 60 * 60 * 1_000;
