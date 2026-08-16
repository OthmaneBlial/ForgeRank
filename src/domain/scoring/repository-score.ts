import { CONFIDENCE_MULTIPLIER, type Confidence } from "../confidence";
import type {
  RepositoryScore,
  RepositoryScoreDimensions,
  RepositoryScoreReason,
} from "../repository";

export const REPOSITORY_SCORE_VERSION = "repository-v1";

export const REPOSITORY_SCORE_MAXIMA: RepositoryScoreDimensions = {
  impact: 25,
  momentum: 20,
  health: 20,
  community: 15,
  engineering: 10,
  trust: 10,
};

export type RepositoryScoreSignals = {
  stars: number | null;
  forks: number | null;
  ageDays: number | null;
  starGrowth30d: number | null;
  starGrowthPrevious30d: number | null;
  activeWeeks12: number | null;
  daysSinceLastCommit: number | null;
  uniqueAuthors90d: number | null;
  topContributorShare: number | null;
  hasReadme: boolean | null;
  hasLicense: boolean | null;
  hasTests: boolean | null;
  hasCi: boolean | null;
  isFork: boolean | null;
  isArchived: boolean;
  anomalyCount: number;
  confidence: Confidence;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const logNormalize = (value: number, softMaximum: number) =>
  clamp(Math.log10(Math.max(0, value) + 1) / Math.log10(softMaximum + 1));

function availableBooleanShare(values: Array<boolean | null>): number | null {
  const available = values.filter((value): value is boolean => value !== null);
  if (available.length === 0) return null;
  return available.filter(Boolean).length / available.length;
}

function weightedAverage(values: Array<[number | null, number]>): number | null {
  const available = values.filter((value): value is [number, number] => value[0] !== null);
  if (available.length === 0) return null;
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  return available.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
}

function dimension(value: number | null, maximum: number): number {
  return Math.round(clamp(value ?? 0) * maximum * 10) / 10;
}

const formatCount = (value: number): string => new Intl.NumberFormat("en-US").format(value);

function createReasons(
  signals: RepositoryScoreSignals,
  ratios: {
    impact: number | null;
    momentum: number | null;
    health: number | null;
    community: number | null;
    engineering: number | null;
    qualitySignals: number | null;
    availableQualitySignalCount: number;
    detectedQualitySignalCount: number;
  },
): RepositoryScoreReason[] {
  const reasons: RepositoryScoreReason[] = [];

  const impactMetrics = [
    signals.stars === null ? null : `${formatCount(signals.stars)} stars`,
    signals.forks === null ? null : `${formatCount(signals.forks)} forks`,
    signals.ageDays === null ? null : `${formatCount(signals.ageDays)} days of repository age`,
  ].filter((metric): metric is string => metric !== null);
  reasons.push(
    impactMetrics.length === 0
      ? {
          dimension: "impact",
          tone: "MISSING",
          summary: "Impact evidence is unavailable",
          detail: "Stars, forks, and repository age have not been observed.",
        }
      : {
          dimension: "impact",
          tone: ratios.impact !== null && ratios.impact >= 0.6 ? "POSITIVE" : "NEUTRAL",
          summary:
            ratios.impact !== null && ratios.impact >= 0.6
              ? "Observed reach provides a strong impact signal"
              : "Observed reach contributes to impact",
          detail: `${impactMetrics.join(", ")} were available to this calculation. Forks are treated as an imperfect adoption signal.`,
        },
  );

  if (signals.starGrowth30d === null) {
    reasons.push({
      dimension: "momentum",
      tone: "MISSING",
      summary: "Momentum needs more observed history",
      detail:
        "At least two valid star observations in the 30-day window are required; no historical growth is reconstructed.",
    });
  } else {
    reasons.push({
      dimension: "momentum",
      tone:
        ratios.momentum !== null && ratios.momentum >= 0.7
          ? "POSITIVE"
          : signals.starGrowth30d <= 0
            ? "CAUTION"
            : "NEUTRAL",
      summary:
        ratios.momentum !== null && ratios.momentum >= 0.7
          ? "Strong observed 30-day momentum"
          : signals.starGrowth30d <= 0
            ? "No positive star growth was observed"
            : "Observed star growth contributes to momentum",
      detail:
        signals.starGrowthPrevious30d === null
          ? `${formatCount(signals.starGrowth30d)} net stars were observed in the available 30-day window; acceleration is unavailable without the preceding window.`
          : `${formatCount(signals.starGrowth30d)} net stars were observed in the available 30-day window, compared with ${formatCount(signals.starGrowthPrevious30d)} in the preceding window.`,
    });
  }

  const healthInputs = [
    signals.daysSinceLastCommit,
    signals.activeWeeks12,
    ratios.qualitySignals,
  ].filter((value) => value !== null).length;
  if (healthInputs === 0) {
    reasons.push({
      dimension: "health",
      tone: "MISSING",
      summary: "Maintenance health is unobserved",
      detail:
        "Commit freshness, active-week cadence, and repository file-presence signals are unavailable.",
    });
  } else {
    const healthEvidence = [
      signals.daysSinceLastCommit === null
        ? null
        : `latest bounded Git commit ${formatCount(signals.daysSinceLastCommit)} day${signals.daysSinceLastCommit === 1 ? "" : "s"} ago`,
      signals.activeWeeks12 === null ? null : `${signals.activeWeeks12} of 12 recent weeks active`,
      ratios.availableQualitySignalCount === 0
        ? null
        : `${ratios.detectedQualitySignalCount} of ${ratios.availableQualitySignalCount} file-presence signals detected`,
    ].filter((metric): metric is string => metric !== null);
    reasons.push({
      dimension: "health",
      tone:
        ratios.health !== null && ratios.health >= 0.75
          ? "POSITIVE"
          : signals.daysSinceLastCommit !== null && signals.daysSinceLastCommit > 180
            ? "CAUTION"
            : "NEUTRAL",
      summary:
        ratios.health !== null && ratios.health >= 0.75
          ? "Recent maintenance signals are strong"
          : signals.daysSinceLastCommit !== null && signals.daysSinceLastCommit > 180
            ? "Recent maintenance activity is limited"
            : "Available maintenance signals inform health",
      detail: `${healthEvidence.join("; ")}. File presence does not prove code quality or security.`,
    });
  }

  if (signals.uniqueAuthors90d === null && signals.topContributorShare === null) {
    reasons.push({
      dimension: "community",
      tone: "MISSING",
      summary: "Contributor structure is unobserved",
      detail: "Bounded Git author count and contribution distribution are unavailable.",
    });
  } else {
    const communityEvidence = [
      signals.uniqueAuthors90d === null
        ? null
        : `${formatCount(signals.uniqueAuthors90d)} Git author${signals.uniqueAuthors90d === 1 ? "" : "s"} observed over 90 days`,
      signals.topContributorShare === null
        ? null
        : `top author share ${Math.round(signals.topContributorShare * 100)}%`,
    ].filter((metric): metric is string => metric !== null);
    reasons.push({
      dimension: "community",
      tone:
        signals.topContributorShare !== null && signals.topContributorShare > 0.65
          ? "CAUTION"
          : signals.topContributorShare !== null && signals.topContributorShare <= 0.4
            ? "POSITIVE"
            : "NEUTRAL",
      summary:
        signals.topContributorShare !== null && signals.topContributorShare > 0.65
          ? "Recent contribution activity is concentrated"
          : signals.topContributorShare !== null && signals.topContributorShare <= 0.4
            ? "Recent contribution activity is distributed"
            : "Observed author structure informs community",
      detail: `${communityEvidence.join("; ")}. Git authors are not inferred to be public user accounts.`,
    });
  }

  if (
    signals.activeWeeks12 === null &&
    signals.daysSinceLastCommit === null &&
    ratios.qualitySignals === null
  ) {
    reasons.push({
      dimension: "engineering",
      tone: "MISSING",
      summary: "Engineering evidence is unavailable",
      detail:
        "Active-week cadence, commit freshness, and repository file-presence signals have not been inspected.",
    });
  } else {
    reasons.push({
      dimension: "engineering",
      tone: ratios.engineering !== null && ratios.engineering >= 0.75 ? "POSITIVE" : "NEUTRAL",
      summary:
        ratios.engineering !== null && ratios.engineering >= 0.75
          ? "Engineering activity and file signals are well represented"
          : "Available engineering signals contribute to the score",
      detail: `${signals.activeWeeks12 === null ? "Active-week cadence unavailable" : `${signals.activeWeeks12} of 12 recent weeks active`}; ${ratios.availableQualitySignalCount === 0 ? "file-presence signals unavailable" : `${ratios.detectedQualitySignalCount} of ${ratios.availableQualitySignalCount} file-presence signals detected`}. These signals do not assess code correctness.`,
    });
  }

  const trustDeductions = [
    signals.isFork ? "fork status" : null,
    signals.isArchived ? "archived status" : null,
    signals.anomalyCount > 0
      ? `${signals.anomalyCount} low-confidence anomaly signal${signals.anomalyCount === 1 ? "" : "s"}`
      : null,
  ].filter((deduction): deduction is string => deduction !== null);
  reasons.push({
    dimension: "trust",
    tone:
      signals.confidence === "INSUFFICIENT"
        ? "MISSING"
        : trustDeductions.length > 0 || signals.confidence === "LOW"
          ? "CAUTION"
          : signals.confidence === "HIGH"
            ? "POSITIVE"
            : "NEUTRAL",
    summary:
      signals.confidence === "INSUFFICIENT"
        ? "Additional observations are required"
        : trustDeductions.length > 0
          ? "Trust deductions apply to this calculation"
          : `${signals.confidence.toLowerCase()}-confidence evidence informs trust`,
    detail: `${signals.confidence} observation confidence applies a ${CONFIDENCE_MULTIPLIER[signals.confidence].toFixed(2)}× multiplier to the total${trustDeductions.length === 0 ? ", with no fork, archive, or anomaly deduction" : `; deductions include ${trustDeductions.join(", ")}`}.`,
  });

  return reasons;
}

export function calculateRepositoryScore(signals: RepositoryScoreSignals): RepositoryScore {
  const starReach = signals.stars === null ? null : logNormalize(signals.stars, 250_000);
  const forkReach = signals.forks === null ? null : logNormalize(signals.forks, 50_000);
  const ageSurvival =
    signals.ageDays === null ? null : clamp(Math.log1p(signals.ageDays) / Math.log1p(3650));

  const impactRatio = weightedAverage([
    [starReach, 0.62],
    [forkReach, 0.23],
    [ageSurvival, 0.15],
  ]);

  const growthRate =
    signals.starGrowth30d === null || signals.stars === null
      ? null
      : clamp(signals.starGrowth30d / Math.max(25, signals.stars - signals.starGrowth30d), 0, 1.5) /
        1.5;
  const absoluteGrowth =
    signals.starGrowth30d === null ? null : logNormalize(signals.starGrowth30d, 10_000);
  const acceleration =
    signals.starGrowth30d === null || signals.starGrowthPrevious30d === null
      ? null
      : clamp(
          (signals.starGrowth30d - signals.starGrowthPrevious30d) /
            Math.max(10, Math.abs(signals.starGrowthPrevious30d)),
          -1,
          1,
        ) /
          2 +
        0.5;
  const momentumRatio = weightedAverage([
    [growthRate, 0.44],
    [absoluteGrowth, 0.34],
    [acceleration, 0.22],
  ]);

  const freshness =
    signals.daysSinceLastCommit === null ? null : clamp(1 - signals.daysSinceLastCommit / 365);
  const activeWeeks = signals.activeWeeks12 === null ? null : clamp(signals.activeWeeks12 / 12);
  const qualitySignals = availableBooleanShare([
    signals.hasReadme,
    signals.hasLicense,
    signals.hasTests,
    signals.hasCi,
  ]);
  const healthRatio = weightedAverage([
    [freshness, 0.45],
    [activeWeeks, 0.35],
    [qualitySignals, 0.2],
  ]);

  const authorDepth =
    signals.uniqueAuthors90d === null ? null : logNormalize(signals.uniqueAuthors90d, 40);
  const distribution =
    signals.topContributorShare === null ? null : clamp(1 - signals.topContributorShare);
  const communityRatio = weightedAverage([
    [authorDepth, 0.55],
    [distribution, 0.45],
  ]);

  const engineeringRatio = weightedAverage([
    [activeWeeks, 0.45],
    [qualitySignals, 0.4],
    [freshness, 0.15],
  ]);

  const anomalyPenalty = clamp(signals.anomalyCount * 0.12, 0, 0.48);
  const forkPenalty = signals.isFork ? 0.22 : 0;
  const archivedPenalty = signals.isArchived ? 0.5 : 0;
  const trustRatio = clamp(
    CONFIDENCE_MULTIPLIER[signals.confidence] - anomalyPenalty - forkPenalty - archivedPenalty,
  );

  const dimensions: RepositoryScoreDimensions = {
    impact: dimension(impactRatio, REPOSITORY_SCORE_MAXIMA.impact),
    momentum: dimension(momentumRatio, REPOSITORY_SCORE_MAXIMA.momentum),
    health: dimension(healthRatio, REPOSITORY_SCORE_MAXIMA.health),
    community: dimension(communityRatio, REPOSITORY_SCORE_MAXIMA.community),
    engineering: dimension(engineeringRatio, REPOSITORY_SCORE_MAXIMA.engineering),
    trust: dimension(trustRatio, REPOSITORY_SCORE_MAXIMA.trust),
  };

  const availableQualitySignals = [
    signals.hasReadme,
    signals.hasLicense,
    signals.hasTests,
    signals.hasCi,
  ].filter((value): value is boolean => value !== null);
  const reasons = createReasons(signals, {
    impact: impactRatio,
    momentum: momentumRatio,
    health: healthRatio,
    community: communityRatio,
    engineering: engineeringRatio,
    qualitySignals,
    availableQualitySignalCount: availableQualitySignals.length,
    detectedQualitySignalCount: availableQualitySignals.filter(Boolean).length,
  });

  const rawTotal = Object.values(dimensions).reduce((sum, value) => sum + value, 0);

  return {
    ...dimensions,
    total: Math.round(rawTotal * CONFIDENCE_MULTIPLIER[signals.confidence] * 10) / 10,
    version: REPOSITORY_SCORE_VERSION,
    confidence: signals.confidence,
    reasons,
  };
}
