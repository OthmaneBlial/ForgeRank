export const DEFAULT_SNAPSHOT_RETENTION = {
  fullResolutionDays: 90,
  dailyResolutionDays: 365,
} as const;

export type SnapshotRetentionCandidate = {
  id: string;
  entityKey: string;
  observedAt: Date;
};

export type SnapshotRetentionPlan = {
  keptIds: string[];
  removedIds: string[];
  keptByTier: { recent: number; daily: number; weekly: number };
};

export function planSnapshotRetention(
  snapshots: SnapshotRetentionCandidate[],
  now: Date,
  policy: { fullResolutionDays: number; dailyResolutionDays: number } = DEFAULT_SNAPSHOT_RETENTION,
): SnapshotRetentionPlan {
  if (policy.fullResolutionDays < 1 || policy.dailyResolutionDays <= policy.fullResolutionDays)
    throw new Error(
      "Snapshot retention requires dailyResolutionDays greater than fullResolutionDays.",
    );
  const dayMs = 86_400_000;
  const recentCutoff = now.getTime() - policy.fullResolutionDays * dayMs;
  const dailyCutoff = now.getTime() - policy.dailyResolutionDays * dayMs;
  const retainedBuckets = new Set<string>();
  const keptIds: string[] = [];
  const removedIds: string[] = [];
  const keptByTier = { recent: 0, daily: 0, weekly: 0 };
  const ordered = snapshots.toSorted(
    (left, right) =>
      right.observedAt.getTime() - left.observedAt.getTime() || left.id.localeCompare(right.id),
  );
  for (const snapshot of ordered) {
    const timestamp = snapshot.observedAt.getTime();
    if (timestamp >= recentCutoff) {
      keptIds.push(snapshot.id);
      keptByTier.recent += 1;
      continue;
    }
    const tier = timestamp >= dailyCutoff ? "daily" : "weekly";
    const bucket = `${snapshot.entityKey}:${tier}:${tier === "daily" ? utcDay(snapshot.observedAt) : utcWeek(snapshot.observedAt)}`;
    if (retainedBuckets.has(bucket)) {
      removedIds.push(snapshot.id);
      continue;
    }
    retainedBuckets.add(bucket);
    keptIds.push(snapshot.id);
    keptByTier[tier] += 1;
  }
  return { keptIds, removedIds, keptByTier };
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utcWeek(value: Date): string {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}
