import type { Maturity } from "./repository";

export const REPOSITORY_SIGNAL_VERSION = "signals-v1";
export const REPOSITORY_SIGNAL_THRESHOLDS = {
  maintainedActiveWeeks12: 8,
  maintainedMaximumCommitAgeDays: 30,
  lowerActivityMaximumWeeks12: 2,
  lowerActivityCommitAgeDays: 180,
  concentratedTopAuthorShare: 0.65,
  distributedMinimumAuthors90d: 4,
  distributedMaximumTopAuthorShare: 0.4,
  positiveMomentumScore: 55,
  positiveRepositoryStructureShare: 0.7,
} as const;

export type RepositorySignalTone = "POSITIVE" | "NEUTRAL" | "CAUTION";

export type RepositorySignal = {
  key: string;
  title: string;
  status: string;
  detail: string;
  tone: RepositorySignalTone;
};

export type RepositorySignalInput = {
  maturity: Maturity | null;
  momentum: number | null;
  snapshotCount: number;
  activeWeeks12: number | null;
  latestCommitAt: Date | null;
  uniqueAuthors90d: number | null;
  topContributorShare: number | null;
  tagCount: number | null;
  qualitySignals: Record<string, boolean | null> | null;
};

const DAY_MS = 24 * 60 * 60 * 1_000;

export function deriveRepositorySignals(
  input: RepositorySignalInput,
  now = new Date(),
): RepositorySignal[] {
  const signals: RepositorySignal[] = [];
  const daysSinceLatestCommit = input.latestCommitAt
    ? Math.max(0, Math.floor((now.getTime() - input.latestCommitAt.getTime()) / DAY_MS))
    : null;

  if (input.activeWeeks12 !== null && daysSinceLatestCommit !== null) {
    const cadenceDetail =
      input.activeWeeks12 +
      "/12 recent weeks include commits; the latest bounded Git commit is " +
      daysSinceLatestCommit +
      " day" +
      (daysSinceLatestCommit === 1 ? "" : "s") +
      " old.";
    if (
      input.activeWeeks12 >= REPOSITORY_SIGNAL_THRESHOLDS.maintainedActiveWeeks12 &&
      daysSinceLatestCommit <= REPOSITORY_SIGNAL_THRESHOLDS.maintainedMaximumCommitAgeDays
    ) {
      signals.push({
        key: "maintained",
        title: "Maintained",
        status: "Strong recent cadence",
        detail: cadenceDetail,
        tone: "POSITIVE",
      });
    } else if (
      input.activeWeeks12 <= REPOSITORY_SIGNAL_THRESHOLDS.lowerActivityMaximumWeeks12 ||
      daysSinceLatestCommit > REPOSITORY_SIGNAL_THRESHOLDS.lowerActivityCommitAgeDays
    ) {
      signals.push({
        key: "activity-cooling",
        title: "Lower recent activity",
        status: "Cadence has slowed",
        detail: cadenceDetail + " This does not imply abandonment.",
        tone: "CAUTION",
      });
    } else {
      signals.push({
        key: "activity-observed",
        title: "Activity observed",
        status: "Intermittent cadence",
        detail: cadenceDetail,
        tone: "NEUTRAL",
      });
    }
  }

  if (input.uniqueAuthors90d !== null && input.topContributorShare !== null) {
    const share = Math.round(input.topContributorShare * 100);
    if (input.topContributorShare >= REPOSITORY_SIGNAL_THRESHOLDS.concentratedTopAuthorShare) {
      signals.push({
        key: "contributor-concentration",
        title: "Contributor concentration",
        status: "Top author " + share + "%",
        detail:
          input.uniqueAuthors90d +
          " non-bot Git authors were observed over 90 days. Concentration is context, not an exact bus factor or a quality verdict.",
        tone: "CAUTION",
      });
    } else if (
      input.uniqueAuthors90d >= REPOSITORY_SIGNAL_THRESHOLDS.distributedMinimumAuthors90d &&
      input.topContributorShare <= REPOSITORY_SIGNAL_THRESHOLDS.distributedMaximumTopAuthorShare
    ) {
      signals.push({
        key: "distributed-authorship",
        title: "Distributed authorship",
        status: input.uniqueAuthors90d + " recent authors",
        detail:
          "The top non-bot Git author accounts for " +
          share +
          "% of observed 90-day commits. Git authors are not inferred to be public accounts.",
        tone: "POSITIVE",
      });
    } else {
      signals.push({
        key: "contributor-structure",
        title: "Contributor structure",
        status: input.uniqueAuthors90d + " recent authors",
        detail:
          "The top non-bot Git author accounts for " +
          share +
          "% of observed 90-day commits. This is a concentration estimate, not an exact bus factor.",
        tone: "NEUTRAL",
      });
    }
  }

  if (input.maturity) {
    const lifecycle = lifecycleSignal(input.maturity);
    if (lifecycle) signals.push(lifecycle);
  }

  if (input.momentum !== null && input.snapshotCount >= 2) {
    signals.push({
      key: "observed-momentum",
      title: "Observed momentum",
      status: input.momentum.toFixed(1) + " / 100",
      detail:
        "Calculated from " +
        input.snapshotCount +
        " persisted ForgeRank observations. It measures changing attention and activity, not code quality.",
      tone:
        input.momentum >= REPOSITORY_SIGNAL_THRESHOLDS.positiveMomentumScore
          ? "POSITIVE"
          : "NEUTRAL",
    });
  }

  if (input.qualitySignals) {
    const available = Object.values(input.qualitySignals).filter(
      (value): value is boolean => value !== null,
    );
    if (available.length > 0) {
      const detected = available.filter(Boolean).length;
      signals.push({
        key: "repository-structures",
        title: "Repository structures",
        status: detected + "/" + available.length + " detected",
        detail:
          "README, license, community guidance, tests, CI, containers, release automation, dependency management, and dedicated documentation are file-presence signals—not proof of correctness or security.",
        tone:
          detected / available.length >=
          REPOSITORY_SIGNAL_THRESHOLDS.positiveRepositoryStructureShare
            ? "POSITIVE"
            : "NEUTRAL",
      });
    }
  }

  if (input.tagCount !== null) {
    signals.push({
      key: "git-tags",
      title: "Git tag evidence",
      status: input.tagCount.toLocaleString("en") + " visible",
      detail:
        input.tagCount > 0
          ? "Tags were visible to the bounded Git inspection. A count alone does not establish release cadence."
          : "No tags were visible to the bounded Git inspection. This does not prove the project has never released.",
      tone: "NEUTRAL",
    });
  }

  return signals;
}

function lifecycleSignal(maturity: Maturity): RepositorySignal | null {
  if (maturity === "REVIVED")
    return {
      key: "revived",
      title: "Revived",
      status: "Renewed sustained activity",
      detail: "A measured quiet period is followed by renewed bounded Git activity.",
      tone: "POSITIVE",
    };
  if (maturity === "EMERGING" || maturity === "GROWING")
    return {
      key: "lifecycle-growth",
      title: maturity === "EMERGING" ? "Emerging" : "Growing",
      status: "Lifecycle evidence",
      detail:
        "Repository age, recent activity, and available snapshot growth meet this versioned lifecycle rule.",
      tone: "POSITIVE",
    };
  if (maturity === "ESTABLISHED" || maturity === "MATURE")
    return {
      key: "lifecycle-established",
      title: maturity === "MATURE" ? "Mature" : "Established",
      status: "Lifecycle evidence",
      detail: "Repository age and sustained bounded activity meet this versioned lifecycle rule.",
      tone: "NEUTRAL",
    };
  if (maturity === "SLOWING" || maturity === "DORMANT")
    return {
      key: "lifecycle-lower-activity",
      title: maturity === "DORMANT" ? "Dormant signal" : "Slowing signal",
      status: "Lower recent activity",
      detail:
        "The current lifecycle rule observes lower activity relative to repository age. It does not predict project intent.",
      tone: "CAUTION",
    };
  if (maturity === "NEW")
    return {
      key: "lifecycle-new",
      title: "Newly observed project",
      status: "Early lifecycle",
      detail:
        "The repository is young; ForgeRank withholds mature-project conclusions while evidence accumulates.",
      tone: "NEUTRAL",
    };
  return null;
}
