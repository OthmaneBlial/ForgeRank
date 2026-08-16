import { describe, expect, it } from "vitest";

import {
  aggregateEcosystems,
  calculateComparableGrowth,
  ecosystemSlug,
  type ComparableSnapshot,
  type EcosystemRepositoryEvidence,
} from "./comparison";

const at = (day: number, stars: number | null): ComparableSnapshot => ({
  observedAt: new Date(`2026-08-${String(day).padStart(2, "0")}T00:00:00.000Z`),
  stars,
});

describe("calculateComparableGrowth", () => {
  it("uses only the shared observation window", () => {
    const result = calculateComparableGrowth(
      new Map([
        ["alpha", [at(1, 100), at(5, 120), at(10, 150)]],
        ["beta", [at(5, 1_000), at(7, 1_050), at(10, 1_100), at(12, 1_200)]],
      ]),
    );
    expect(result.window).toEqual({ start: at(5, 0).observedAt, end: at(10, 0).observedAt });
    expect(result.repositories).toEqual([
      { repositoryId: "alpha", absoluteGrowth: 30, percentageGrowth: 25, observations: 2 },
      { repositoryId: "beta", absoluteGrowth: 100, percentageGrowth: 10, observations: 3 },
    ]);
  });

  it("withholds growth when windows or observations are not comparable", () => {
    expect(
      calculateComparableGrowth(
        new Map([
          ["alpha", [at(1, 100)]],
          ["beta", [at(1, 20), at(2, 25)]],
        ]),
      ).window,
    ).toBeNull();
    expect(
      calculateComparableGrowth(
        new Map([
          ["alpha", [at(1, 100), at(2, 110)]],
          ["beta", [at(5, 20), at(6, 25)]],
        ]),
      ).window,
    ).toBeNull();
  });

  it("rejects a decreasing counter inside the common window", () => {
    const result = calculateComparableGrowth(
      new Map([
        ["alpha", [at(1, 100), at(2, 90)]],
        ["beta", [at(1, 20), at(2, 25)]],
      ]),
    );
    expect(result.window).toBeNull();
    expect(result.repositories[0]?.absoluteGrowth).toBeNull();
  });
});

describe("aggregateEcosystems", () => {
  const repository = (
    overrides: Partial<EcosystemRepositoryEvidence>,
  ): EcosystemRepositoryEvidence => ({
    id: "repo",
    ecosystem: "Rust",
    fullName: "forge/repo",
    stars: null,
    score: null,
    health: null,
    community: null,
    engineering: null,
    momentum: null,
    commits90d: null,
    activeWeeks12: null,
    uniqueAuthors90d: null,
    ...overrides,
  });

  it("aggregates only observed evidence and retains coverage denominators", () => {
    const [rust] = aggregateEcosystems(
      ["Rust"],
      [
        repository({
          id: "a",
          fullName: "sharkdp/bat",
          stars: 10_000,
          score: 80,
          health: 16,
          commits90d: 40,
          activeWeeks12: 10,
          uniqueAuthors90d: 8,
        }),
        repository({
          id: "b",
          fullName: "rust-lang/rust",
          stars: 20_000,
          score: null,
          health: 12,
          commits90d: null,
        }),
        repository({
          id: "c",
          ecosystem: "TypeScript",
          fullName: "microsoft/typescript",
          stars: 100_000,
        }),
      ],
    );
    expect(rust).toMatchObject({
      repositoryCount: 2,
      scoredRepositoryCount: 1,
      gitAnalyzedRepositoryCount: 1,
      activeRepositoryCount: 1,
      totalStars: 30_000,
      totalCommits90d: 40,
      averageScore: 80,
      averageHealth: 14,
    });
    expect(rust?.topRepositories.map((entry) => entry.fullName)).toEqual([
      "sharkdp/bat",
      "rust-lang/rust",
    ]);
  });

  it("keeps absent aggregates null instead of manufacturing zeroes", () => {
    const [entry] = aggregateEcosystems(["Elixir"], []);
    expect(entry).toMatchObject({
      repositoryCount: 0,
      totalStars: 0,
      totalCommits90d: null,
      averageScore: null,
      averageMomentum: null,
    });
  });

  it("creates stable URL slugs", () => {
    expect(ecosystemSlug("C++")).toBe("c-plus-plus");
    expect(ecosystemSlug(" Objective-C ")).toBe("objective-c");
  });
});
