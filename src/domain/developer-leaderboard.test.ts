import { describe, expect, it } from "vitest";

import {
  developerArchetypes,
  rankDeveloperLeaderboard,
  type DeveloperLeaderboardCandidate,
  type DeveloperLeaderboardFilters,
} from "./developer-leaderboard";

function candidate(
  username: string,
  overrides: Partial<DeveloperLeaderboardCandidate> = {},
): DeveloperLeaderboardCandidate {
  return {
    id: username,
    username,
    location: "Paris",
    ecosystems: ["Rust", "TypeScript"],
    currentScore: 50,
    impactScore: 12,
    consistencyScore: 10,
    collaborationScore: 8,
    projectQualityScore: 9,
    breadthScore: 6,
    repositoryCount: 3,
    activeRepositoryCount: 2,
    collaborativeRepositoryCount: 1,
    collaborationCoverage: 2,
    commits30d: 20,
    commits90d: 60,
    scoreChange30d: 4,
    portfolioAgeDays: 1_000,
    ...overrides,
  };
}

function filters(
  overrides: Partial<DeveloperLeaderboardFilters> = {},
): DeveloperLeaderboardFilters {
  return {
    category: "overall",
    activityWindow: "any",
    archetype: "all",
    ...overrides,
  };
}

describe("developer leaderboard", () => {
  it("ranks each category by its explicit persisted signal", () => {
    const entries = rankDeveloperLeaderboard(
      [
        candidate("alpha", { currentScore: 80, impactScore: 10 }),
        candidate("beta", { currentScore: 60, impactScore: 20 }),
      ],
      filters({ category: "impact" }),
    );
    expect(entries.map((entry) => entry.candidate.username)).toEqual(["beta", "alpha"]);
    expect(entries[0]).toMatchObject({ signal: 20, signalLabel: "Impact", signalMaximum: 25 });
  });

  it("withholds collaboration rankings without covered Git-author evidence", () => {
    const entries = rankDeveloperLeaderboard(
      [
        candidate("unknown", { collaborationCoverage: 0, collaborationScore: 0 }),
        candidate("covered"),
      ],
      filters({ category: "collaboration" }),
    );
    expect(entries.map((entry) => entry.candidate.username)).toEqual(["covered"]);
  });

  it("does not replace a missing or negative rising baseline with current score", () => {
    const entries = rankDeveloperLeaderboard(
      [
        candidate("missing", { scoreChange30d: null }),
        candidate("falling", { scoreChange30d: -2 }),
        candidate("rising"),
      ],
      filters({ category: "rising" }),
    );
    expect(entries.map((entry) => entry.candidate.username)).toEqual(["rising"]);
  });

  it("combines only consistency and quality for the documented maintenance signal", () => {
    const [entry] = rankDeveloperLeaderboard(
      [candidate("maintainer", { consistencyScore: 20, projectQualityScore: 15 })],
      filters({ category: "maintainers" }),
    );
    expect(entry).toMatchObject({ signal: 100, signalMaximum: 100 });
  });

  it("uses the requested bounded activity window", () => {
    const entries = rankDeveloperLeaderboard(
      [
        candidate("steady", { commits30d: 5, commits90d: 100 }),
        candidate("burst", { commits30d: 20, commits90d: 30 }),
      ],
      filters({ category: "active", activityWindow: "30" }),
    );
    expect(entries.map((entry) => [entry.candidate.username, entry.signal])).toEqual([
      ["burst", 20],
      ["steady", 5],
    ]);
  });

  it("applies public location, ecosystem, activity, and archetype filters together", () => {
    const entries = rankDeveloperLeaderboard(
      [
        candidate("match"),
        candidate("wrong-location", { location: "Berlin" }),
        candidate("inactive", { commits30d: 0 }),
        candidate("single-project", { repositoryCount: 1 }),
      ],
      filters({ ecosystem: "rust", location: "paris", activityWindow: "30", archetype: "builder" }),
    );
    expect(entries.map((entry) => entry.candidate.username)).toEqual(["match"]);
  });

  it("derives non-exclusive evidence-backed archetypes", () => {
    expect(developerArchetypes(candidate("multi"))).toEqual([
      "builder",
      "maintainer",
      "collaborator",
      "generalist",
    ]);
  });
});
