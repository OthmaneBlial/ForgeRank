import type { Confidence } from "./confidence";
import type { RepositoryListItem } from "./repository";
import { calculateTrend, selectTrendWindowObservations, type TrendObservation } from "./trending";

export const DISCOVERY_MODES = [
  "trending",
  "rising",
  "breakout",
  "improved",
  "gems",
  "established",
  "active",
  "cooling",
] as const;
export type DiscoveryMode = (typeof DISCOVERY_MODES)[number];

export type DiscoveryObservation = TrendObservation & {
  forgeScore?: number | null;
};

export type DiscoveryCandidateInput = {
  repository: RepositoryListItem;
  snapshots: DiscoveryObservation[];
  commits90d: number | null;
  activeWeeks12: number | null;
  uniqueAuthors90d: number | null;
};

export type DiscoveryRanking = {
  repository: RepositoryListItem;
  signalScore: number;
  confidence: Confidence;
  evidence: string[];
  observationCount: number;
  historySpanDays: number;
};

type CandidateSignals = DiscoveryCandidateInput & {
  periodDays: number;
  trend: ReturnType<typeof calculateTrend>;
  observationCount: number;
  historySpanDays: number;
  activity: number;
  popularity: number;
  health: number | null;
  engineering: number | null;
  community: number | null;
  scoreDelta: number | null;
  scoreObservationCount: number;
  confidence: Confidence;
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, value));
const round = (value: number) => Math.round(value * 10) / 10;

export function rankDiscoveryCandidates(
  candidates: DiscoveryCandidateInput[],
  mode: DiscoveryMode,
  periodDays = 7,
  now = new Date(),
): DiscoveryRanking[] {
  const signals = candidates.map((candidate) =>
    deriveSignals(candidate, mode === "breakout" ? Math.max(7, periodDays) : periodDays, now),
  );
  return signals
    .map((candidate) => scoreCandidate(candidate, mode))
    .filter((candidate): candidate is DiscoveryRanking => candidate !== null)
    .sort(
      (left, right) =>
        right.signalScore - left.signalScore ||
        (right.repository.score ?? -1) - (left.repository.score ?? -1) ||
        left.repository.fullName.localeCompare(right.repository.fullName),
    );
}

function deriveSignals(
  input: DiscoveryCandidateInput,
  periodDays: number,
  now: Date,
): CandidateSignals {
  const observations = selectTrendWindowObservations(input.snapshots, periodDays, now);
  const first = observations.at(0);
  const last = observations.at(-1);
  const historySpanDays =
    first && last ? (last.observedAt.getTime() - first.observedAt.getTime()) / DAY_MS : 0;
  const trend = calculateTrend(observations, periodDays);
  const scoredObservations = observations.filter(
    (observation): observation is DiscoveryObservation & { forgeScore: number } =>
      typeof observation.forgeScore === "number" && Number.isFinite(observation.forgeScore),
  );
  const firstScore = scoredObservations.at(0)?.forgeScore;
  const lastScore = scoredObservations.at(-1)?.forgeScore;
  const activity = clamp(
    ((input.activeWeeks12 ?? 0) / 12) * 50 +
      Math.log10((input.commits90d ?? 0) + 1) * 20 +
      Math.log10((input.uniqueAuthors90d ?? 0) + 1) * 15,
  );
  const observationCount = observations.length;
  const confidence: Confidence =
    observationCount >= 5 && historySpanDays >= periodDays * 0.75
      ? "HIGH"
      : observationCount >= 3 && historySpanDays >= Math.min(2, periodDays * 0.5)
        ? "MEDIUM"
        : observationCount >= 2
          ? "LOW"
          : "INSUFFICIENT";
  return {
    ...input,
    periodDays,
    trend,
    observationCount,
    historySpanDays,
    activity,
    popularity: clamp((Math.log10((input.repository.stars ?? 0) + 1) / 6) * 100),
    health: input.repository.health === null ? null : clamp((input.repository.health / 20) * 100),
    engineering:
      input.repository.engineering === null
        ? null
        : clamp((input.repository.engineering / 10) * 100),
    community:
      input.repository.community === null ? null : clamp((input.repository.community / 15) * 100),
    scoreDelta:
      scoredObservations.length >= 2 && firstScore !== undefined && lastScore !== undefined
        ? round(lastScore - firstScore)
        : null,
    scoreObservationCount: scoredObservations.length,
    confidence,
  };
}

function scoreCandidate(candidate: CandidateSignals, mode: DiscoveryMode): DiscoveryRanking | null {
  const { repository, trend } = candidate;
  if (repository.state !== "ACTIVE" || repository.isFork === true || trend.anomaly) return null;
  const base = {
    repository,
    confidence: candidate.confidence,
    observationCount: candidate.observationCount,
    historySpanDays: round(candidate.historySpanDays),
  };
  const trendScore = clamp(trend.score ?? 0);
  const percentageGrowth = trend.percentageGrowth ?? 0;
  const relativeGrowth = clamp(Math.log1p(Math.max(0, percentageGrowth)) * 24);
  const acceleration = clamp(
    ((trend.acceleration ?? 0) / Math.max(1, trend.absoluteGrowth ?? 1)) * 100,
  );

  if (mode === "trending") {
    if (trend.score === null || candidate.confidence === "INSUFFICIENT") return null;
    return {
      ...base,
      signalScore: round(
        trendScore * 0.65 + candidate.activity * 0.2 + candidate.popularity * 0.15,
      ),
      evidence: compactEvidence([
        growthEvidence(trend.absoluteGrowth, percentageGrowth),
        activityEvidence(candidate.activity),
        `${candidate.observationCount} observations across ${round(candidate.historySpanDays)}d`,
      ]),
    };
  }

  if (mode === "rising") {
    if ((trend.absoluteGrowth ?? 0) <= 0 || candidate.confidence === "INSUFFICIENT") return null;
    return {
      ...base,
      signalScore: round(relativeGrowth * 0.55 + acceleration * 0.15 + candidate.activity * 0.3),
      evidence: compactEvidence([
        `${percentageGrowth.toFixed(1)}% observed growth`,
        trend.acceleration !== null && trend.acceleration > 0
          ? "velocity increased inside the window"
          : null,
        activityEvidence(candidate.activity),
      ]),
    };
  }

  if (mode === "breakout") {
    if (
      candidate.observationCount < 4 ||
      candidate.historySpanDays < 6 ||
      (trend.absoluteGrowth ?? 0) <= 0 ||
      (trend.acceleration ?? 0) <= 0 ||
      candidate.activity < 35
    )
      return null;
    const unusualGrowth = clamp(
      relativeGrowth * 0.65 + clamp(Math.log10((trend.absoluteGrowth ?? 0) + 1) * 22) * 0.35,
    );
    if (unusualGrowth < 35) return null;
    return {
      ...base,
      signalScore: round(unusualGrowth * 0.55 + acceleration * 0.2 + candidate.activity * 0.25),
      evidence: [
        `${percentageGrowth.toFixed(1)}% growth relative to baseline`,
        "velocity increased across at least four observations",
        activityEvidence(candidate.activity),
      ],
    };
  }

  if (mode === "improved") {
    if (
      candidate.scoreDelta === null ||
      candidate.scoreDelta <= 0 ||
      candidate.scoreObservationCount < 2 ||
      candidate.confidence === "INSUFFICIENT"
    )
      return null;
    return {
      ...base,
      signalScore: round(
        clamp(candidate.scoreDelta * 10) * 0.55 + candidate.activity * 0.25 + trendScore * 0.2,
      ),
      evidence: compactEvidence([
        `ForgeRank changed +${candidate.scoreDelta.toFixed(1)} across ${candidate.scoreObservationCount} persisted scored observations`,
        growthEvidence(trend.absoluteGrowth, percentageGrowth),
        activityEvidence(candidate.activity),
      ]),
    };
  }

  if (mode === "gems") {
    const stars = repository.stars ?? 0;
    if (
      stars < 50 ||
      stars > 25_000 ||
      candidate.observationCount < 3 ||
      candidate.confidence === "INSUFFICIENT" ||
      candidate.health === null ||
      candidate.health < 60 ||
      candidate.engineering === null ||
      candidate.engineering < 45 ||
      trend.score === null ||
      (trend.absoluteGrowth ?? 0) <= 0
    )
      return null;
    const community = candidate.community ?? 0;
    const lowerVisibility = 100 - candidate.popularity;
    return {
      ...base,
      signalScore: round(
        candidate.health * 0.3 +
          trendScore * 0.3 +
          candidate.engineering * 0.2 +
          community * 0.1 +
          lowerVisibility * 0.1,
      ),
      evidence: [
        `health ${Math.round(candidate.health)}/100 normalized`,
        `engineering ${Math.round(candidate.engineering)}/100 normalized`,
        `${repository.stars?.toLocaleString("en")} stars with positive observed momentum`,
      ],
    };
  }

  if (mode === "established") {
    if (
      !repository.maturity ||
      !["ESTABLISHED", "MATURE"].includes(repository.maturity) ||
      repository.score === null
    )
      return null;
    return {
      ...base,
      confidence: repository.scoreConfidence,
      signalScore: round(repository.score * 0.75 + candidate.activity * 0.25),
      evidence: [
        `${repository.maturity.toLowerCase()} lifecycle`,
        `ForgeRank ${repository.score.toFixed(1)}/100`,
        activityEvidence(candidate.activity),
      ],
    };
  }

  if (mode === "cooling") {
    const importantLifecycle =
      repository.maturity === "ESTABLISHED" || repository.maturity === "MATURE";
    const deceleration =
      trend.acceleration === null || trend.absoluteGrowth === null
        ? null
        : clamp(
            (Math.abs(Math.min(0, trend.acceleration)) / Math.max(1, trend.absoluteGrowth)) * 100,
          );
    if (
      !importantLifecycle ||
      (repository.stars ?? 0) < 10_000 ||
      repository.score === null ||
      candidate.observationCount < 4 ||
      candidate.historySpanDays < Math.min(6, candidate.periodDays * 0.75) ||
      trend.acceleration === null ||
      trend.acceleration >= 0 ||
      deceleration === null ||
      deceleration < 20 ||
      candidate.confidence === "INSUFFICIENT"
    )
      return null;
    return {
      ...base,
      signalScore: round(
        candidate.popularity * 0.3 +
          repository.score * 0.35 +
          deceleration * 0.25 +
          candidate.activity * 0.1,
      ),
      evidence: [
        `Momentum slowed relative to the earlier half of this observed window (${Math.abs(trend.acceleration).toLocaleString("en")} fewer stars added)`,
        `${(repository.stars ?? 0).toLocaleString("en")} observed stars and ForgeRank ${repository.score.toFixed(1)}`,
        activityEvidence(candidate.activity),
      ],
    };
  }

  if (candidate.activeWeeks12 === null || candidate.commits90d === null) return null;
  return {
    ...base,
    confidence: repository.scoreConfidence,
    signalScore: round(candidate.activity),
    evidence: [
      `${candidate.activeWeeks12}/12 active weeks`,
      `${candidate.commits90d} commits and ${candidate.uniqueAuthors90d ?? "unknown"} authors in the observed 90d window`,
    ],
  };
}

function growthEvidence(absoluteGrowth: number | null, percentageGrowth: number): string | null {
  return absoluteGrowth === null
    ? null
    : `+${absoluteGrowth.toLocaleString("en")} stars (${percentageGrowth.toFixed(1)}%) in the observed window`;
}

function activityEvidence(activity: number): string {
  if (activity >= 70) return "strong recent engineering activity";
  if (activity >= 40) return "steady recent engineering activity";
  return "limited recent engineering evidence";
}

function compactEvidence(values: Array<string | null>): string[] {
  return values.filter((value): value is string => value !== null);
}
