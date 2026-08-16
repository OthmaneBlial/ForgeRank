import { confidenceFromObservations, type Confidence } from "./confidence";

export type TrendObservation = {
  observedAt: Date;
  stars: number;
  forks: number | null;
};

export type TrendResult = {
  score: number | null;
  absoluteGrowth: number | null;
  percentageGrowth: number | null;
  acceleration: number | null;
  confidence: Confidence;
  anomaly: string | null;
};

const round = (value: number) => Math.round(value * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1_000;

export function selectTrendWindowObservations<T extends TrendObservation>(
  observations: T[],
  periodDays: number,
  asOf = new Date(),
): T[] {
  const ordered = observations
    .filter(
      (observation) =>
        Number.isFinite(observation.stars) &&
        observation.stars >= 0 &&
        Number.isFinite(observation.observedAt.getTime()) &&
        observation.observedAt <= asOf,
    )
    .toSorted((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
  const cutoff = asOf.getTime() - Math.max(1, periodDays) * DAY_MS;
  const baseline = ordered
    .filter((observation) => observation.observedAt.getTime() < cutoff)
    .at(-1);
  const inside = ordered.filter((observation) => observation.observedAt.getTime() >= cutoff);
  return baseline ? [baseline, ...inside] : inside;
}

export function calculateTrend(observations: TrendObservation[], periodDays = 7): TrendResult {
  const ordered = [...observations].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const confidence = confidenceFromObservations(ordered.length, Math.max(3, periodDays));
  const first = ordered.at(0);
  const last = ordered.at(-1);

  if (!first || !last || ordered.length < 2) {
    return {
      score: null,
      absoluteGrowth: null,
      percentageGrowth: null,
      acceleration: null,
      confidence: "INSUFFICIENT",
      anomaly: null,
    };
  }

  const absoluteGrowth = last.stars - first.stars;
  if (absoluteGrowth < 0) {
    return {
      score: null,
      absoluteGrowth: null,
      percentageGrowth: null,
      acceleration: null,
      confidence: "LOW",
      anomaly: "Observed star count decreased; the measurement requires review.",
    };
  }

  const midpoint = ordered[Math.floor((ordered.length - 1) / 2)];
  const firstLeg = midpoint ? midpoint.stars - first.stars : 0;
  const secondLeg = midpoint ? last.stars - midpoint.stars : 0;
  const acceleration = secondLeg - firstLeg;
  const percentageGrowth = absoluteGrowth / Math.max(1, first.stars);
  const score =
    Math.log10(absoluteGrowth + 1) * 22 +
    Math.min(percentageGrowth, 2) * 28 +
    Math.max(-10, Math.min(10, acceleration / Math.max(10, absoluteGrowth))) * 2;

  return {
    score: round(Math.max(0, score)),
    absoluteGrowth,
    percentageGrowth: round(percentageGrowth * 100),
    acceleration,
    confidence,
    anomaly: null,
  };
}
