import { describe, expect, it } from "vitest";

import {
  analyzeDeveloperPortfolio,
  type DeveloperPortfolioRepositoryEvidence,
} from "./developer-intelligence";

const repository = (
  overrides: Partial<DeveloperPortfolioRepositoryEvidence>,
): DeveloperPortfolioRepositoryEvidence => ({
  repositoryId: "repo",
  fullName: "owner/repo",
  primaryLanguage: null,
  stars: null,
  analyzedAt: null,
  latestCommitAt: null,
  commits30d: null,
  commits90d: null,
  activeWeeks12: null,
  uniqueAuthors90d: null,
  topContributorShare: null,
  ...overrides,
});

describe("analyzeDeveloperPortfolio", () => {
  it("aggregates repository activity without claiming account-level commits", () => {
    const result = analyzeDeveloperPortfolio([
      repository({
        repositoryId: "one",
        fullName: "owner/one",
        primaryLanguage: "Rust",
        stars: 1_000,
        analyzedAt: new Date("2026-08-15"),
        latestCommitAt: new Date("2026-08-14"),
        commits30d: 20,
        commits90d: 50,
        activeWeeks12: 9,
        uniqueAuthors90d: 4,
        topContributorShare: 0.5,
      }),
      repository({
        repositoryId: "two",
        fullName: "owner/two",
        primaryLanguage: "TypeScript",
        stars: 200,
        analyzedAt: new Date("2026-08-10"),
        latestCommitAt: new Date("2026-08-09"),
        commits30d: 0,
        commits90d: 0,
        activeWeeks12: 2,
        uniqueAuthors90d: 1,
        topContributorShare: 1,
      }),
    ]);
    expect(result).toMatchObject({
      repositoryCount: 2,
      analyzedRepositoryCount: 2,
      collaborativeRepositoryCount: 1,
      activeRepositoryCount: 1,
      totalCommits90d: 50,
      averageActiveWeeks12: 5.5,
      authorRepositoryPresences90d: 5,
      strongestLanguage: "Rust",
    });
    expect(result.latestCommitAt).toEqual(new Date("2026-08-14"));
  });

  it("uses repository count then observed stars for strongest language", () => {
    const result = analyzeDeveloperPortfolio([
      repository({ repositoryId: "one", primaryLanguage: "Rust", stars: 50 }),
      repository({ repositoryId: "two", primaryLanguage: "TypeScript", stars: 100 }),
    ]);
    expect(result.strongestLanguage).toBe("TypeScript");
  });

  it("keeps activity and collaboration unavailable when Git evidence is absent", () => {
    expect(analyzeDeveloperPortfolio([repository({ primaryLanguage: "Go" })])).toMatchObject({
      analyzedRepositoryCount: 0,
      collaborativeRepositoryCount: null,
      activeRepositoryCount: null,
      totalCommits30d: null,
      totalCommits90d: null,
      averageTopContributorShare: null,
    });
  });
});
