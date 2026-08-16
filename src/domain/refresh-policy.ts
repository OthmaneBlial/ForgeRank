import type { Maturity, RepositoryState } from "./repository";

export const REFRESH_TIERS = ["HOT", "ACTIVE", "NORMAL", "COLD"] as const;

export type RefreshTier = (typeof REFRESH_TIERS)[number];

export const REFRESH_INTERVAL_MS: Record<RefreshTier, number> = {
  HOT: 6 * 60 * 60 * 1_000,
  ACTIVE: 24 * 60 * 60 * 1_000,
  NORMAL: 3 * 24 * 60 * 60 * 1_000,
  COLD: 14 * 24 * 60 * 60 * 1_000,
};

export type RefreshPolicyInput = {
  state: RepositoryState;
  maturity: Maturity | null;
  stars: number | null;
  momentum: number | null;
  lastActivityAt: Date | null;
  lastSuccessfulFetchAt: Date | null;
  lastRefreshCompletedAt: Date | null;
  collectionCount: number;
  pageViewCount: number;
  lastViewedAt: Date | null;
  refreshRequestCount: number;
  lastRefreshRequestedAt: Date | null;
};

export type RefreshDecision = {
  tier: RefreshTier;
  priority: number;
  nextRefreshAt: Date;
  due: boolean;
  reasons: string[];
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const ageInDays = (date: Date | null, now: Date): number | null =>
  date ? Math.max(0, (now.getTime() - date.getTime()) / DAY_MS) : null;

export function classifyRefreshTier(input: RefreshPolicyInput, now = new Date()): RefreshTier {
  const activityAge = ageInDays(input.lastActivityAt, now);
  const viewAge = ageInDays(input.lastViewedAt, now);

  if (
    input.state !== "ACTIVE" ||
    input.maturity === "DORMANT" ||
    (activityAge !== null && activityAge >= 365 && input.collectionCount === 0)
  ) {
    return "COLD";
  }

  if (
    (input.momentum !== null &&
      input.momentum >= 55 &&
      (activityAge === null || activityAge <= 30)) ||
    (input.pageViewCount >= 100 && viewAge !== null && viewAge <= 7)
  ) {
    return "HOT";
  }

  if (
    input.collectionCount > 0 ||
    (input.stars !== null &&
      input.stars >= 10_000 &&
      (activityAge === null || activityAge <= 90)) ||
    (activityAge !== null && activityAge <= 45) ||
    input.maturity === "GROWING" ||
    input.maturity === "REVIVED"
  ) {
    return "ACTIVE";
  }

  return "NORMAL";
}

export function calculateRefreshPriority(
  input: RefreshPolicyInput,
  tier: RefreshTier,
  now = new Date(),
): { priority: number; reasons: string[] } {
  const reasons: string[] = [`${tier.toLowerCase()} cadence`];
  const base = { HOT: 55, ACTIVE: 40, NORMAL: 25, COLD: 8 }[tier];
  const interval = REFRESH_INTERVAL_MS[tier];
  const latestCompletedRefresh = latestDate(
    input.lastSuccessfulFetchAt,
    input.lastRefreshCompletedAt,
  );
  const staleness = latestCompletedRefresh
    ? Math.max(0, now.getTime() - latestCompletedRefresh.getTime())
    : Number.POSITIVE_INFINITY;
  const stalenessPoints = Number.isFinite(staleness)
    ? Math.min(25, Math.floor((staleness / interval) * 18))
    : 25;
  if (stalenessPoints > 0)
    reasons.push(input.lastSuccessfulFetchAt ? "snapshot staleness" : "awaiting first observation");

  const collectionPoints = Math.min(10, input.collectionCount * 5);
  if (collectionPoints > 0) reasons.push("curated collection membership");

  const popularityPoints =
    input.stars === null
      ? 0
      : Math.min(10, Math.floor(Math.log10(Math.max(1, input.stars) + 1) * 2));
  if (popularityPoints > 0) reasons.push("observed popularity");

  const momentumPoints =
    input.momentum === null ? 0 : Math.min(12, Math.floor(Math.max(0, input.momentum) / 5));
  if (momentumPoints > 0) reasons.push("observed momentum");

  const viewAge = ageInDays(input.lastViewedAt, now);
  const viewPoints =
    Math.min(8, Math.floor(Math.log2(Math.max(0, input.pageViewCount) + 1))) +
    (viewAge !== null && viewAge <= 7 ? 4 : 0);
  if (viewPoints > 0) reasons.push("repository page interest");

  const pendingRefreshRequest = Boolean(
    input.lastRefreshRequestedAt &&
    (!latestCompletedRefresh || input.lastRefreshRequestedAt > latestCompletedRefresh),
  );
  const requestPoints = pendingRefreshRequest
    ? Math.min(25, 16 + Math.floor(Math.log2(input.refreshRequestCount + 1) * 3))
    : 0;
  if (requestPoints > 0) reasons.push("pending user refresh request");

  const activityAge = ageInDays(input.lastActivityAt, now);
  const activityPoints = activityAge !== null && activityAge <= 30 ? 5 : 0;
  if (activityPoints > 0) reasons.push("recent Git activity");

  return {
    priority: Math.min(
      100,
      base +
        stalenessPoints +
        collectionPoints +
        popularityPoints +
        momentumPoints +
        viewPoints +
        requestPoints +
        activityPoints,
    ),
    reasons,
  };
}

export function decideRepositoryRefresh(
  input: RefreshPolicyInput,
  now = new Date(),
): RefreshDecision {
  const tier = classifyRefreshTier(input, now);
  const latestCompletedRefresh = latestDate(
    input.lastSuccessfulFetchAt,
    input.lastRefreshCompletedAt,
  );
  const pendingRefreshRequest = Boolean(
    input.lastRefreshRequestedAt &&
    (!latestCompletedRefresh || input.lastRefreshRequestedAt > latestCompletedRefresh),
  );
  const nextRefreshAt =
    pendingRefreshRequest || !latestCompletedRefresh
      ? now
      : new Date(latestCompletedRefresh.getTime() + REFRESH_INTERVAL_MS[tier]);
  const { priority, reasons } = calculateRefreshPriority(input, tier, now);
  return { tier, priority, nextRefreshAt, due: nextRefreshAt <= now, reasons };
}

function latestDate(left: Date | null, right: Date | null): Date | null {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}
