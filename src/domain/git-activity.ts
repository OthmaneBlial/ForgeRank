import { MATURITY_THRESHOLDS } from "./scoring/maturity";

const DAY_MS = 24 * 60 * 60 * 1_000;

export const GIT_ACTIVITY_THRESHOLDS = {
  revivalQuietDays: MATURITY_THRESHOLDS.revivalQuietDays,
  renewalLookbackDays: 180,
} as const;

/**
 * Returns the most recent fully observed quiet interval that ended inside the
 * renewal lookback. Sustained renewed activity is evaluated separately by the
 * lifecycle classifier, so a lone commit cannot make a repository "revived".
 */
export function calculatePreviousDormantPeriodDays(
  commitDates: Date[],
  asOf = new Date(),
): number | null {
  const orderedTimes = [
    ...new Set(
      commitDates
        .map((date) => date.getTime())
        .filter((timestamp) => Number.isFinite(timestamp) && timestamp <= asOf.getTime()),
    ),
  ].toSorted((left, right) => left - right);
  if (orderedTimes.length < 2) return null;

  const renewalCutoff = asOf.getTime() - GIT_ACTIVITY_THRESHOLDS.renewalLookbackDays * DAY_MS;
  for (let index = orderedTimes.length - 1; index > 0; index -= 1) {
    const renewalAt = orderedTimes[index];
    const previousCommitAt = orderedTimes[index - 1];
    if (renewalAt === undefined || previousCommitAt === undefined) continue;
    if (renewalAt < renewalCutoff) break;
    const gapDays = Math.floor((renewalAt - previousCommitAt) / DAY_MS);
    if (gapDays >= GIT_ACTIVITY_THRESHOLDS.revivalQuietDays) return gapDays;
  }
  return null;
}
