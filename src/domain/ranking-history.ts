export type RankHistoryPoint = {
  calculatedAt: Date;
  rank: number;
  score: number;
  rankingVersion: string;
};

export type RankMovementSummary = {
  baselineAt: Date;
  latestAt: Date;
  fromRank: number;
  toRank: number;
  places: number;
  direction: "UP" | "DOWN" | "UNCHANGED";
  observedSpanDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1_000;

export function summarizeRankMovement(
  points: RankHistoryPoint[],
  windowDays: number,
  asOf = new Date(),
): RankMovementSummary | null {
  const ordered = points
    .filter(
      (point) =>
        Number.isInteger(point.rank) &&
        point.rank > 0 &&
        Number.isFinite(point.calculatedAt.getTime()) &&
        point.calculatedAt <= asOf,
    )
    .toSorted((left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime());
  const latest = ordered.at(-1);
  if (!latest) return null;
  const cutoff = asOf.getTime() - Math.max(1, windowDays) * DAY_MS;
  const baseline = ordered.filter((point) => point.calculatedAt.getTime() <= cutoff).at(-1);
  if (!baseline || baseline.calculatedAt >= latest.calculatedAt) return null;

  const signedPlaces = baseline.rank - latest.rank;
  return {
    baselineAt: baseline.calculatedAt,
    latestAt: latest.calculatedAt,
    fromRank: baseline.rank,
    toRank: latest.rank,
    places: Math.abs(signedPlaces),
    direction: signedPlaces > 0 ? "UP" : signedPlaces < 0 ? "DOWN" : "UNCHANGED",
    observedSpanDays:
      Math.round(
        ((latest.calculatedAt.getTime() - baseline.calculatedAt.getTime()) / DAY_MS) * 10,
      ) / 10,
  };
}

export function summarizeRankMovementWindows(points: RankHistoryPoint[], asOf = new Date()) {
  return [
    { label: "24H", windowDays: 1 },
    { label: "7D", windowDays: 7 },
    { label: "30D", windowDays: 30 },
  ].map((window) => ({
    ...window,
    movement: summarizeRankMovement(points, window.windowDays, asOf),
  }));
}
