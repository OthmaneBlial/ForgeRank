import { describe, expect, it } from "vitest";

import type { RepositoryListItem } from "./repository";
import {
  calculateEcosystemMovements,
  rankRepositoryMovers,
  selectNewObservedRepositories,
  type EcosystemReportSnapshot,
} from "./reports";

const now = new Date("2026-08-16T12:00:00.000Z");
const day = 24 * 60 * 60 * 1_000;

function repository(
  fullName: string,
  overrides: Partial<RepositoryListItem> = {},
): RepositoryListItem {
  const [owner, name] = fullName.split("/") as [string, string];
  return {
    id: fullName,
    owner,
    name,
    fullName,
    description: null,
    primaryLanguage: "TypeScript",
    license: "MIT",
    defaultBranch: "main",
    isFork: false,
    stars: 1_000,
    forks: 100,
    score: 70,
    health: 15,
    community: 10,
    engineering: 7,
    scoreConfidence: "HIGH",
    momentum: 20,
    sevenDayGrowth: null,
    discoveredAt: new Date(now.getTime() - day),
    observedAt: now,
    repositoryCreatedAt: null,
    lastActivityAt: now,
    maturity: "GROWING",
    rank: null,
    previousRank: null,
    state: "ACTIVE",
    refreshTier: "ACTIVE",
    nextRefreshAt: null,
    ...overrides,
  };
}

function ecosystem(
  name: string,
  daysAgo: number,
  totalStars: number,
  overrides: Partial<EcosystemReportSnapshot> = {},
): EcosystemReportSnapshot {
  return {
    ecosystemKey: name.toLowerCase(),
    ecosystemName: name,
    observedAt: new Date(now.getTime() - daysAgo * day),
    repositoryCount: 4,
    scoredRepositoryCount: 3,
    totalStars,
    averageScore: 65,
    averageMomentum: 12,
    ...overrides,
  };
}

describe("deterministic report selection", () => {
  it("sorts rank movement by absolute places with upward ties first", () => {
    const movements = rankRepositoryMovers([
      repository("a/up", { rank: 2, previousRank: 8 }),
      repository("b/down", { rank: 9, previousRank: 3 }),
      repository("c/static", { rank: 4, previousRank: 4 }),
    ]);
    expect(
      movements.map((movement) => [
        movement.repository.fullName,
        movement.places,
        movement.direction,
      ]),
    ).toEqual([
      ["a/up", 6, "UP"],
      ["b/down", 6, "DOWN"],
    ]);
  });

  it("selects only newly discovered repositories with real observations", () => {
    const selected = selectNewObservedRepositories(
      [
        repository("new/observed", { discoveredAt: new Date(now.getTime() - 2 * day) }),
        repository("new/identifier-only", {
          discoveredAt: new Date(now.getTime() - day),
          observedAt: null,
        }),
        repository("old/observed", { discoveredAt: new Date(now.getTime() - 10 * day) }),
        repository("new/fork", {
          discoveredAt: new Date(now.getTime() - day),
          isFork: true,
        }),
      ],
      7,
      now,
    );
    expect(selected.map((item) => item.fullName)).toEqual(["new/observed"]);
  });

  it("uses a real baseline at or before the requested ecosystem window", () => {
    const movements = calculateEcosystemMovements(
      [
        ecosystem("Rust", 8, 10_000, { averageScore: 60 }),
        ecosystem("Rust", 2, 10_500, { averageScore: 64 }),
        ecosystem("Rust", 0, 11_000, { averageScore: 66 }),
        ecosystem("Go", 8, 20_000),
        ecosystem("Go", 0, 19_900),
        ecosystem("Python", 2, 30_000),
        ecosystem("Python", 0, 31_000),
      ],
      7,
      now,
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      ecosystemName: "Rust",
      starGrowth: 1_000,
      starGrowthPercent: 10,
      averageScoreChange: 6,
      historySpanDays: 8,
    });
  });
});
