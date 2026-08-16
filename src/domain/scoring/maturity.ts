import type { Maturity } from "../repository";

export type MaturitySignals = {
  ageDays: number | null;
  daysSinceLastCommit: number | null;
  activeWeeks12: number | null;
  growth30d: number | null;
  previousDormantPeriodDays: number | null;
};

export const MATURITY_THRESHOLDS = {
  newMaximumAgeDays: 90,
  revivalQuietDays: 180,
  revivalMinimumActiveWeeks12: 4,
  revivalMaximumCommitAgeDays: 30,
  dormantMinimumCommitAgeDays: 365,
  emergingMinimumActiveWeeks12: 3,
  growingMinimumActiveWeeks12: 6,
  matureMinimumAgeDays: 1_825,
  maintainedMinimumActiveWeeks12: 4,
} as const;

export function classifyMaturity(signals: MaturitySignals): Maturity | null {
  const activeWeeks = signals.activeWeeks12 ?? 0;
  const growth = signals.growth30d ?? 0;

  if (
    signals.previousDormantPeriodDays !== null &&
    signals.previousDormantPeriodDays >= MATURITY_THRESHOLDS.revivalQuietDays &&
    activeWeeks >= MATURITY_THRESHOLDS.revivalMinimumActiveWeeks12 &&
    (signals.daysSinceLastCommit ?? Number.POSITIVE_INFINITY) <=
      MATURITY_THRESHOLDS.revivalMaximumCommitAgeDays
  ) {
    return "REVIVED";
  }
  if ((signals.daysSinceLastCommit ?? 0) >= MATURITY_THRESHOLDS.dormantMinimumCommitAgeDays)
    return "DORMANT";
  if (signals.ageDays === null) return null;
  if (signals.ageDays < MATURITY_THRESHOLDS.newMaximumAgeDays)
    return growth > 0 && activeWeeks >= MATURITY_THRESHOLDS.emergingMinimumActiveWeeks12
      ? "EMERGING"
      : "NEW";
  if (growth > 0 && activeWeeks >= MATURITY_THRESHOLDS.growingMinimumActiveWeeks12)
    return "GROWING";
  if (
    signals.ageDays >= MATURITY_THRESHOLDS.matureMinimumAgeDays &&
    activeWeeks >= MATURITY_THRESHOLDS.maintainedMinimumActiveWeeks12
  )
    return "MATURE";
  if (activeWeeks >= MATURITY_THRESHOLDS.maintainedMinimumActiveWeeks12) return "ESTABLISHED";
  return "SLOWING";
}
