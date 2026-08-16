import { CONFIDENCE_MULTIPLIER, type Confidence } from "../confidence";
import type { DeveloperScore, DeveloperScoreDimensions } from "../developer";

export const DEVELOPER_SCORE_VERSION = "developer-v1";
export const DEVELOPER_SCORE_MAXIMA: DeveloperScoreDimensions = {
  impact: 25,
  consistency: 20,
  collaboration: 20,
  projectQuality: 15,
  breadth: 10,
  trust: 10,
};

export type DeveloperScoreSignals = {
  ownedOriginalStars: number | null;
  ownedRepositoryCount: number;
  averageRepositoryScore: number | null;
  activeOwnedRepositoryCount: number | null;
  collaborationRepositoryCount: number | null;
  activeMonths12: number | null;
  languageCount: number | null;
  confidence: Confidence;
};

const CONFIDENCE_ORDER: Confidence[] = ["INSUFFICIENT", "LOW", "MEDIUM", "HIGH"];

export function deriveDeveloperScoreConfidence(
  signals: Pick<
    DeveloperScoreSignals,
    "ownedRepositoryCount" | "activeMonths12" | "collaborationRepositoryCount" | "confidence"
  >,
): Confidence {
  if (signals.ownedRepositoryCount === 0) return "INSUFFICIENT";
  const evidenceConfidence: Confidence =
    signals.ownedRepositoryCount >= 5 &&
    signals.activeMonths12 !== null &&
    signals.collaborationRepositoryCount !== null
      ? "HIGH"
      : signals.ownedRepositoryCount >= 3 &&
          (signals.activeMonths12 !== null || signals.collaborationRepositoryCount !== null)
        ? "MEDIUM"
        : "LOW";
  return (
    CONFIDENCE_ORDER[
      Math.min(
        CONFIDENCE_ORDER.indexOf(signals.confidence),
        CONFIDENCE_ORDER.indexOf(evidenceConfidence),
      )
    ] ?? "INSUFFICIENT"
  );
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const logNormalize = (value: number, max: number) =>
  clamp(Math.log10(Math.max(0, value) + 1) / Math.log10(max + 1));
const weighted = (values: Array<[number | null, number]>): number | null => {
  const available = values.filter((value): value is [number, number] => value[0] !== null);
  if (available.length === 0) return null;
  const weight = available.reduce((sum, value) => sum + value[1], 0);
  return available.reduce((sum, value) => sum + value[0] * value[1], 0) / weight;
};
const points = (ratio: number | null, maximum: number) =>
  Math.round((ratio ?? 0) * maximum * 10) / 10;

export function calculateDeveloperScore(signals: DeveloperScoreSignals): DeveloperScore {
  const impactRatio = weighted([
    [
      signals.ownedOriginalStars === null
        ? null
        : logNormalize(signals.ownedOriginalStars, 1_000_000),
      0.65,
    ],
    [
      signals.averageRepositoryScore === null ? null : clamp(signals.averageRepositoryScore / 100),
      0.35,
    ],
  ]);
  const consistencyRatio = weighted([
    [signals.activeMonths12 === null ? null : clamp(signals.activeMonths12 / 12), 0.55],
    [
      signals.activeOwnedRepositoryCount === null || signals.ownedRepositoryCount === 0
        ? null
        : clamp(signals.activeOwnedRepositoryCount / signals.ownedRepositoryCount),
      0.45,
    ],
  ]);
  const collaborationRatio =
    signals.collaborationRepositoryCount === null
      ? null
      : logNormalize(signals.collaborationRepositoryCount, 20);
  const projectQualityRatio =
    signals.averageRepositoryScore === null ? null : clamp(signals.averageRepositoryScore / 100);
  const breadthRatio = weighted([
    [logNormalize(signals.ownedRepositoryCount, 30), 0.55],
    [signals.languageCount === null ? null : logNormalize(signals.languageCount, 8), 0.45],
  ]);
  const dimensions = {
    impact: points(impactRatio, DEVELOPER_SCORE_MAXIMA.impact),
    consistency: points(consistencyRatio, DEVELOPER_SCORE_MAXIMA.consistency),
    collaboration: points(collaborationRatio, DEVELOPER_SCORE_MAXIMA.collaboration),
    projectQuality: points(projectQualityRatio, DEVELOPER_SCORE_MAXIMA.projectQuality),
    breadth: points(breadthRatio, DEVELOPER_SCORE_MAXIMA.breadth),
    trust: points(CONFIDENCE_MULTIPLIER[signals.confidence], DEVELOPER_SCORE_MAXIMA.trust),
  };
  const reasons: string[] = [];
  if (signals.ownedRepositoryCount > 0)
    reasons.push(`${signals.ownedRepositoryCount} owned original repositories are indexed`);
  if (signals.ownedOriginalStars !== null && signals.ownedOriginalStars > 10_000)
    reasons.push("Strong observed reach across owned projects");
  if (signals.activeMonths12 === null)
    reasons.push("Cross-repository activity history is incomplete");
  if (signals.collaborationRepositoryCount === null)
    reasons.push("Confirmed collaboration evidence is unavailable");
  const total =
    Object.values(dimensions).reduce((sum, value) => sum + value, 0) *
    CONFIDENCE_MULTIPLIER[signals.confidence];
  return {
    ...dimensions,
    total: Math.round(total * 10) / 10,
    version: DEVELOPER_SCORE_VERSION,
    confidence: signals.confidence,
    reasons,
  };
}
