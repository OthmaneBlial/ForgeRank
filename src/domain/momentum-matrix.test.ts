import { describe, expect, it } from "vitest";

import type { RepositoryListItem } from "./repository";
import { filterMomentumMatrixPoints, type MomentumMatrixPoint } from "./momentum-matrix";

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
    license: null,
    defaultBranch: "main",
    isFork: false,
    stars: 1_000,
    forks: 100,
    score: 70,
    health: 15,
    community: 10,
    engineering: 8,
    scoreConfidence: "HIGH",
    momentum: 50,
    sevenDayGrowth: null,
    discoveredAt: new Date("2026-01-01T00:00:00.000Z"),
    observedAt: new Date("2026-08-16T00:00:00.000Z"),
    repositoryCreatedAt: new Date("2024-01-01T00:00:00.000Z"),
    lastActivityAt: new Date("2026-08-15T00:00:00.000Z"),
    maturity: "GROWING",
    rank: 1,
    previousRank: 2,
    state: "ACTIVE",
    refreshTier: "ACTIVE",
    nextRefreshAt: null,
    ...overrides,
  };
}

function point(
  fullName: string,
  overrides: Partial<MomentumMatrixPoint> = {},
): MomentumMatrixPoint {
  return {
    repository: repository(fullName),
    growth30d: 100,
    growthConfidence: "LOW",
    historySpanDays: 40,
    ageDays: 900,
    topicSlugs: ["frontend"],
    ...overrides,
  };
}

describe("momentum matrix filters", () => {
  it("composes language, topic, age, and minimum-star filters", () => {
    const values = [
      point("one/eligible"),
      point("two/rust", {
        repository: repository("two/rust", { primaryLanguage: "Rust" }),
      }),
      point("three/young", { ageDays: 40 }),
      point("four/other-topic", { topicSlugs: ["databases"] }),
      point("five/small", { repository: repository("five/small", { stars: 400 }) }),
    ];
    expect(
      filterMomentumMatrixPoints(values, {
        language: "TypeScript",
        topic: "frontend",
        age: "1-3",
        minimumStars: 500,
      }).map((value) => value.repository.fullName),
    ).toEqual(["one/eligible"]);
  });

  it("withholds age-filtered points when repository age is unavailable", () => {
    expect(
      filterMomentumMatrixPoints([point("one/unknown", { ageDays: null })], {
        age: "5-plus",
        minimumStars: 0,
      }),
    ).toEqual([]);
  });

  it("sorts eligible points by momentum, score, then stable identity", () => {
    const values = [
      point("z/low", { repository: repository("z/low", { momentum: 20 }) }),
      point("b/high", { repository: repository("b/high", { momentum: 80, score: 60 }) }),
      point("a/high", { repository: repository("a/high", { momentum: 80, score: 80 }) }),
    ];
    expect(
      filterMomentumMatrixPoints(values, { age: "all", minimumStars: 0 }).map(
        (value) => value.repository.fullName,
      ),
    ).toEqual(["a/high", "b/high", "z/low"]);
  });
});
