import type { Confidence } from "./confidence";
import { MATURITY_THRESHOLDS } from "./scoring/maturity";

const DAY_MS = 24 * 60 * 60 * 1_000;

export const REPOSITORY_EVENT_VERSION = "repository-events-v1";
export const REPOSITORY_EVENT_THRESHOLDS = {
  starMilestones: [1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000],
  rankMilestones: [100, 50, 10],
  momentumDimensionIncrease: 4,
} as const;

export type RepositoryEventKind =
  | "TRACKING_STARTED"
  | "STAR_MILESTONE"
  | "RANK_MILESTONE"
  | "MOMENTUM_INCREASED"
  | "ACTIVITY_RESUMED"
  | "NEW_TAGS_OBSERVED"
  | "DORMANCY_OBSERVED";

export type RepositoryEvent = {
  id: string;
  kind: RepositoryEventKind;
  occurredAt: Date;
  title: string;
  detail: string;
  source: "Repository snapshots" | "Completed ranking runs" | "Bounded Git analyses";
  confidence: Confidence;
  version: typeof REPOSITORY_EVENT_VERSION;
};

export type RepositoryEventSnapshot = {
  observedAt: Date;
  stars: number | null;
  momentumScore: number | null;
  scoreVersion: string | null;
  anomalyFlags: string[];
  confidence: Confidence;
};

export type RepositoryEventRank = {
  calculatedAt: Date;
  rank: number;
  rankingVersion: string;
};

export type RepositoryEventGitAnalysis = {
  analyzedAt: Date;
  latestCommitAt: Date | null;
  activeWeeks12: number | null;
  previousDormantPeriodDays: number | null;
  tagCount: number | null;
};

export function deriveRepositoryEvents(input: {
  snapshots: RepositoryEventSnapshot[];
  ranks: RepositoryEventRank[];
  gitAnalyses: RepositoryEventGitAnalysis[];
}): RepositoryEvent[] {
  const events: RepositoryEvent[] = [];
  const snapshots = input.snapshots
    .filter((snapshot) => validDate(snapshot.observedAt))
    .toSorted((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
  const firstSnapshot = snapshots.at(0);
  if (firstSnapshot) {
    events.push(
      event({
        id: `tracking:${firstSnapshot.observedAt.toISOString()}`,
        kind: "TRACKING_STARTED",
        occurredAt: firstSnapshot.observedAt,
        title: "ForgeRank tracking began",
        detail:
          "This is the first retained repository observation. It is not presented as the repository creation date.",
        source: "Repository snapshots",
        confidence: firstSnapshot.confidence,
      }),
    );
  }

  deriveStarMilestones(snapshots, events);
  deriveMomentumChanges(snapshots, events);
  deriveRankMilestones(input.ranks, events);
  deriveGitEvents(input.gitAnalyses, events);

  return events.toSorted(
    (left, right) =>
      right.occurredAt.getTime() - left.occurredAt.getTime() || left.id.localeCompare(right.id),
  );
}

function deriveStarMilestones(
  snapshots: RepositoryEventSnapshot[],
  events: RepositoryEvent[],
): void {
  const clean = snapshots.filter(
    (snapshot): snapshot is RepositoryEventSnapshot & { stars: number } =>
      snapshot.stars !== null && snapshot.stars >= 0 && snapshot.anomalyFlags.length === 0,
  );
  const emitted = new Set<number>();
  for (let index = 1; index < clean.length; index += 1) {
    const previous = clean[index - 1];
    const current = clean[index];
    if (!previous || !current || current.stars < previous.stars) continue;
    for (const threshold of REPOSITORY_EVENT_THRESHOLDS.starMilestones) {
      if (emitted.has(threshold) || previous.stars >= threshold || current.stars < threshold)
        continue;
      emitted.add(threshold);
      events.push(
        event({
          id: `stars:${threshold}:${current.observedAt.toISOString()}`,
          kind: "STAR_MILESTONE",
          occurredAt: current.observedAt,
          title: `${compactThreshold(threshold)} observed-star milestone`,
          detail: `The observed count moved from ${previous.stars.toLocaleString("en")} to ${current.stars.toLocaleString("en")} between retained snapshots. The exact external crossing time is not reconstructed.`,
          source: "Repository snapshots",
          confidence: lowerConfidence(previous.confidence, current.confidence),
        }),
      );
    }
  }
}

function deriveMomentumChanges(
  snapshots: RepositoryEventSnapshot[],
  events: RepositoryEvent[],
): void {
  const scored = snapshots.filter(
    (snapshot): snapshot is RepositoryEventSnapshot & { momentumScore: number } =>
      snapshot.momentumScore !== null &&
      Number.isFinite(snapshot.momentumScore) &&
      snapshot.scoreVersion !== null &&
      snapshot.anomalyFlags.length === 0,
  );
  for (let index = 1; index < scored.length; index += 1) {
    const previous = scored[index - 1];
    const current = scored[index];
    if (!previous || !current || previous.scoreVersion !== current.scoreVersion) continue;
    const increase = current.momentumScore - previous.momentumScore;
    if (increase < REPOSITORY_EVENT_THRESHOLDS.momentumDimensionIncrease) continue;
    events.push(
      event({
        id: `momentum:${current.observedAt.toISOString()}`,
        kind: "MOMENTUM_INCREASED",
        occurredAt: current.observedAt,
        title: "Momentum dimension increased",
        detail: `The versioned momentum dimension increased by ${increase.toFixed(1)} points between retained scored snapshots using ${current.scoreVersion}.`,
        source: "Repository snapshots",
        confidence: lowerConfidence(previous.confidence, current.confidence),
      }),
    );
  }
}

function deriveRankMilestones(ranks: RepositoryEventRank[], events: RepositoryEvent[]): void {
  const ordered = ranks
    .filter((rank) => validDate(rank.calculatedAt) && Number.isInteger(rank.rank) && rank.rank > 0)
    .toSorted((left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime());
  const emitted = new Set<number>();
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current || previous.rankingVersion !== current.rankingVersion) continue;
    for (const threshold of REPOSITORY_EVENT_THRESHOLDS.rankMilestones) {
      if (emitted.has(threshold) || previous.rank <= threshold || current.rank > threshold)
        continue;
      emitted.add(threshold);
      events.push(
        event({
          id: `rank:${threshold}:${current.calculatedAt.toISOString()}`,
          kind: "RANK_MILESTONE",
          occurredAt: current.calculatedAt,
          title: `Entered the ForgeRank Top ${threshold}`,
          detail: `The completed global ranking moved from #${previous.rank} to #${current.rank} using ${current.rankingVersion}. This rank applies only to ForgeRank's indexed and scored cohort.`,
          source: "Completed ranking runs",
          confidence: "HIGH",
        }),
      );
    }
  }
}

function deriveGitEvents(analyses: RepositoryEventGitAnalysis[], events: RepositoryEvent[]): void {
  const ordered = analyses
    .filter((analysis) => validDate(analysis.analyzedAt))
    .toSorted((left, right) => left.analyzedAt.getTime() - right.analyzedAt.getTime());
  let previouslyRevived = false;
  let previouslyDormant: boolean | null = null;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (!current) continue;
    const previous = ordered[index - 1];
    if (
      previous?.tagCount !== null &&
      previous?.tagCount !== undefined &&
      current.tagCount !== null &&
      current.tagCount > previous.tagCount
    ) {
      const added = current.tagCount - previous.tagCount;
      events.push(
        event({
          id: `tags:${current.analyzedAt.toISOString()}`,
          kind: "NEW_TAGS_OBSERVED",
          occurredAt: current.analyzedAt,
          title: `${added.toLocaleString("en")} new Git tag${added === 1 ? "" : "s"} observed`,
          detail: `The bounded Git tag count changed from ${previous.tagCount.toLocaleString("en")} to ${current.tagCount.toLocaleString("en")}. Tags are not automatically labeled releases.`,
          source: "Bounded Git analyses",
          confidence: "HIGH",
        }),
      );
    }

    const commitAgeDays = daysBetween(current.latestCommitAt, current.analyzedAt);
    const revived =
      current.previousDormantPeriodDays !== null &&
      current.previousDormantPeriodDays >= MATURITY_THRESHOLDS.revivalQuietDays &&
      (current.activeWeeks12 ?? 0) >= MATURITY_THRESHOLDS.revivalMinimumActiveWeeks12 &&
      commitAgeDays !== null &&
      commitAgeDays <= MATURITY_THRESHOLDS.revivalMaximumCommitAgeDays;
    if (revived && !previouslyRevived) {
      events.push(
        event({
          id: `revived:${current.analyzedAt.toISOString()}`,
          kind: "ACTIVITY_RESUMED",
          occurredAt: current.analyzedAt,
          title: "Sustained activity resumed",
          detail: `A measured ${current.previousDormantPeriodDays}-day quiet interval was followed by ${current.activeWeeks12}/12 active weeks and a latest commit ${commitAgeDays} days before analysis.`,
          source: "Bounded Git analyses",
          confidence: "MEDIUM",
        }),
      );
    }
    previouslyRevived = revived;

    const dormant =
      commitAgeDays !== null && commitAgeDays >= MATURITY_THRESHOLDS.dormantMinimumCommitAgeDays;
    if (previouslyDormant === false && dormant) {
      events.push(
        event({
          id: `dormant:${current.analyzedAt.toISOString()}`,
          kind: "DORMANCY_OBSERVED",
          occurredAt: current.analyzedAt,
          title: "Dormancy threshold observed",
          detail: `The latest known commit was ${commitAgeDays} days old at this bounded analysis. This describes observed activity, not maintainer intent.`,
          source: "Bounded Git analyses",
          confidence: "HIGH",
        }),
      );
    }
    previouslyDormant = dormant;
  }
}

function event(value: Omit<RepositoryEvent, "version">): RepositoryEvent {
  return { ...value, version: REPOSITORY_EVENT_VERSION };
}

function daysBetween(earlier: Date | null, later: Date): number | null {
  if (!earlier || !validDate(earlier) || earlier > later) return null;
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

function validDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function lowerConfidence(left: Confidence, right: Confidence): Confidence {
  const order: Confidence[] = ["INSUFFICIENT", "LOW", "MEDIUM", "HIGH"];
  return order[Math.min(order.indexOf(left), order.indexOf(right))] ?? "INSUFFICIENT";
}

function compactThreshold(value: number): string {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  return `${value / 1_000}k`;
}
