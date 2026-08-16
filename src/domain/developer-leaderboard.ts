export const DEVELOPER_LEADERBOARD_CATEGORIES = [
  "overall",
  "impact",
  "consistency",
  "collaboration",
  "builders",
  "maintainers",
  "rising",
  "active",
  "veterans",
] as const;

export const DEVELOPER_ARCHETYPES = [
  "all",
  "builder",
  "maintainer",
  "collaborator",
  "generalist",
] as const;
export const DEVELOPER_ACTIVITY_WINDOWS = ["any", "30", "90"] as const;

export type DeveloperLeaderboardCategory = (typeof DEVELOPER_LEADERBOARD_CATEGORIES)[number];
export type DeveloperArchetype = (typeof DEVELOPER_ARCHETYPES)[number];
export type DeveloperActivityWindow = (typeof DEVELOPER_ACTIVITY_WINDOWS)[number];

export interface DeveloperLeaderboardCandidate {
  id: string;
  username: string;
  location: string | null;
  ecosystems: string[];
  currentScore: number | null;
  impactScore: number | null;
  consistencyScore: number | null;
  collaborationScore: number | null;
  projectQualityScore: number | null;
  breadthScore: number | null;
  repositoryCount: number;
  activeRepositoryCount: number | null;
  collaborativeRepositoryCount: number | null;
  collaborationCoverage: number;
  commits30d: number | null;
  commits90d: number | null;
  scoreChange30d: number | null;
  portfolioAgeDays: number | null;
}

export interface DeveloperLeaderboardFilters {
  category: DeveloperLeaderboardCategory;
  ecosystem?: string;
  location?: string;
  activityWindow: DeveloperActivityWindow;
  archetype: DeveloperArchetype;
}

export interface DeveloperLeaderboardEntry<
  T extends DeveloperLeaderboardCandidate = DeveloperLeaderboardCandidate,
> {
  candidate: T;
  position: number;
  signal: number;
  signalLabel: string;
  signalMaximum: number | null;
  evidence: string;
}

export function developerArchetypes(
  candidate: DeveloperLeaderboardCandidate,
): Exclude<DeveloperArchetype, "all">[] {
  const archetypes: Exclude<DeveloperArchetype, "all">[] = [];
  if (candidate.repositoryCount >= 2) archetypes.push("builder");
  if ((candidate.activeRepositoryCount ?? 0) > 0) archetypes.push("maintainer");
  if ((candidate.collaborativeRepositoryCount ?? 0) > 0 && candidate.collaborationCoverage > 0) {
    archetypes.push("collaborator");
  }
  if (candidate.ecosystems.length >= 2) archetypes.push("generalist");
  return archetypes;
}

function categorySignal(
  candidate: DeveloperLeaderboardCandidate,
  filters: DeveloperLeaderboardFilters,
): Omit<DeveloperLeaderboardEntry, "candidate" | "position"> | null {
  switch (filters.category) {
    case "overall":
      return candidate.currentScore === null
        ? null
        : {
            signal: candidate.currentScore,
            signalLabel: "Developer score",
            signalMaximum: 100,
            evidence: `Versioned score across ${candidate.repositoryCount} indexed owned original ${candidate.repositoryCount === 1 ? "project" : "projects"}`,
          };
    case "impact":
      return candidate.impactScore === null
        ? null
        : {
            signal: candidate.impactScore,
            signalLabel: "Impact",
            signalMaximum: 25,
            evidence: "Persisted impact dimension from observed project reach and quality",
          };
    case "consistency":
      return candidate.consistencyScore === null
        ? null
        : {
            signal: candidate.consistencyScore,
            signalLabel: "Consistency",
            signalMaximum: 20,
            evidence: "Persisted consistency dimension from covered portfolio activity",
          };
    case "collaboration":
      return candidate.collaborationScore === null || candidate.collaborationCoverage === 0
        ? null
        : {
            signal: candidate.collaborationScore,
            signalLabel: "Collaboration",
            signalMaximum: 20,
            evidence: `${candidate.collaborationCoverage}/${candidate.repositoryCount} owned projects have bounded Git-author coverage`,
          };
    case "builders":
      return candidate.breadthScore === null || candidate.repositoryCount === 0
        ? null
        : {
            signal: candidate.breadthScore,
            signalLabel: "Builder breadth",
            signalMaximum: 10,
            evidence: `${candidate.repositoryCount} indexed owned originals across ${candidate.ecosystems.length} observed ecosystems`,
          };
    case "maintainers": {
      if (
        candidate.consistencyScore === null ||
        candidate.projectQualityScore === null ||
        candidate.activeRepositoryCount === null
      ) {
        return null;
      }
      const maintenanceSignal =
        (candidate.consistencyScore / 20) * 55 + (candidate.projectQualityScore / 15) * 45;
      return {
        signal: Math.round(maintenanceSignal * 10) / 10,
        signalLabel: "Maintenance signal",
        signalMaximum: 100,
        evidence: `${candidate.activeRepositoryCount}/${candidate.repositoryCount} owned projects active in their latest bounded analysis`,
      };
    }
    case "rising":
      return candidate.scoreChange30d === null || candidate.scoreChange30d <= 0
        ? null
        : {
            signal: candidate.scoreChange30d,
            signalLabel: "30d score change",
            signalMaximum: null,
            evidence: "Current score compared with a real snapshot at least 30 days earlier",
          };
    case "active": {
      const useThirtyDays = filters.activityWindow === "30";
      const commits = useThirtyDays ? candidate.commits30d : candidate.commits90d;
      return commits === null
        ? null
        : {
            signal: commits,
            signalLabel: useThirtyDays ? "Project commits / 30d" : "Project commits / 90d",
            signalMaximum: null,
            evidence: "Bounded Git commits across indexed owned projects, not personal commits",
          };
    }
    case "veterans":
      return candidate.portfolioAgeDays === null
        ? null
        : {
            signal: candidate.portfolioAgeDays,
            signalLabel: "Observed portfolio age",
            signalMaximum: null,
            evidence: "Age of the oldest indexed owned original project, not account age",
          };
  }
}

export function rankDeveloperLeaderboard<T extends DeveloperLeaderboardCandidate>(
  candidates: T[],
  filters: DeveloperLeaderboardFilters,
): Array<DeveloperLeaderboardEntry<T>> {
  const ecosystem = filters.ecosystem?.toLocaleLowerCase();
  const location = filters.location?.toLocaleLowerCase();
  const filtered = candidates.filter((candidate) => {
    if (
      ecosystem &&
      !candidate.ecosystems.some((value) => value.toLocaleLowerCase() === ecosystem)
    ) {
      return false;
    }
    if (location && candidate.location?.toLocaleLowerCase() !== location) return false;
    if (filters.activityWindow === "30" && (candidate.commits30d ?? 0) <= 0) return false;
    if (filters.activityWindow === "90" && (candidate.commits90d ?? 0) <= 0) return false;
    if (
      filters.archetype !== "all" &&
      !developerArchetypes(candidate).includes(filters.archetype)
    ) {
      return false;
    }
    return true;
  });

  return filtered
    .map((candidate) => {
      const signal = categorySignal(candidate, filters);
      return signal ? { candidate, position: 0, ...signal } : null;
    })
    .filter((entry): entry is DeveloperLeaderboardEntry<T> => entry !== null)
    .toSorted(
      (left, right) =>
        right.signal - left.signal ||
        left.candidate.username.localeCompare(right.candidate.username),
    )
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}
