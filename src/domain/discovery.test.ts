import { describe, expect, it } from "vitest";

import type { RepositoryListItem } from "./repository";
import { rankDiscoveryCandidates, type DiscoveryCandidateInput } from "./discovery";

const now = new Date("2026-08-15T12:00:00.000Z");
const day = 24 * 60 * 60 * 1_000;
const observed = (daysAgo: number, stars: number, forgeScore: number | null = null) => ({
  observedAt: new Date(now.getTime() - daysAgo * day),
  stars,
  forks: null,
  forgeScore,
});

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
    score: 75,
    health: 17,
    community: 11,
    engineering: 8,
    scoreConfidence: "HIGH",
    momentum: 50,
    sevenDayGrowth: null,
    discoveredAt: now,
    observedAt: now,
    repositoryCreatedAt: new Date(now.getTime() - 365 * day),
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

function candidate(
  fullName: string,
  snapshots: DiscoveryCandidateInput["snapshots"],
  overrides: Partial<DiscoveryCandidateInput> = {},
): DiscoveryCandidateInput {
  return {
    repository: repository(fullName),
    snapshots,
    commits90d: 90,
    activeWeeks12: 10,
    uniqueAuthors90d: 12,
    ...overrides,
  };
}

describe("discovery rankings", () => {
  const steady = candidate(
    "large/steady",
    [observed(7, 100_000), observed(4, 100_080), observed(2, 100_140), observed(0, 100_200)],
    { repository: repository("large/steady", { stars: 100_200, maturity: "MATURE" }) },
  );
  const breakout = candidate(
    "young/breakout",
    [observed(7, 500), observed(5, 560), observed(2, 750), observed(0, 1_200)],
    { repository: repository("young/breakout", { stars: 1_200, maturity: "EMERGING" }) },
  );
  const gem = candidate(
    "small/healthy",
    [observed(7, 760), observed(4, 780), observed(2, 820), observed(0, 900)],
    {
      repository: repository("small/healthy", {
        stars: 900,
        health: 19,
        engineering: 9,
        community: 13,
      }),
    },
  );

  it("separates breakout velocity from established impact", () => {
    expect(
      rankDiscoveryCandidates([steady, breakout, gem], "breakout", 7, now).map(
        (entry) => entry.repository.fullName,
      ),
    ).toContain("young/breakout");
    expect(
      rankDiscoveryCandidates([steady, breakout, gem], "established", 7, now).map(
        (entry) => entry.repository.fullName,
      ),
    ).toEqual(["large/steady"]);
  });

  it("requires health, engineering, moderate visibility, and repeated positive observations for gems", () => {
    const names = rankDiscoveryCandidates([steady, gem], "gems", 7, now).map(
      (entry) => entry.repository.fullName,
    );
    expect(names).toEqual(["small/healthy"]);
  });

  it("does not publish one-observation projects as trends", () => {
    const insufficient = candidate("new/unknown", [observed(0, 20)]);
    expect(rankDiscoveryCandidates([insufficient], "trending", 7, now)).toEqual([]);
    expect(rankDiscoveryCandidates([insufficient], "gems", 7, now)).toEqual([]);
  });

  it("rejects counter decreases as a measurement anomaly", () => {
    const decreasing = candidate("broken/counter", [observed(7, 50_000), observed(0, 49_900)]);
    expect(rankDiscoveryCandidates([decreasing], "trending", 7, now)).toEqual([]);
  });

  it("uses Git-derived activity for the most-active mode without requiring star movement", () => {
    const names = rankDiscoveryCandidates([steady], "active", 7, now).map(
      (entry) => entry.repository.fullName,
    );
    expect(names).toEqual(["large/steady"]);
  });

  it("ranks most-improved projects only from repeated persisted score observations", () => {
    const improved = candidate("steady/improver", [
      observed(7, 1_000, 61),
      observed(4, 1_030, 66),
      observed(0, 1_080, 73),
    ]);
    const unscored = candidate("unscored/growth", [
      observed(7, 1_000),
      observed(4, 1_100),
      observed(0, 1_300),
    ]);
    expect(
      rankDiscoveryCandidates([unscored, improved], "improved", 7, now).map(
        (entry) => entry.repository.fullName,
      ),
    ).toEqual(["steady/improver"]);
  });

  it("describes cooling giants neutrally from measured deceleration", () => {
    const cooling = candidate(
      "large/cooling",
      [observed(7, 100_000), observed(5, 100_500), observed(2, 100_650), observed(0, 100_700)],
      {
        repository: repository("large/cooling", {
          stars: 100_700,
          score: 86,
          maturity: "MATURE",
        }),
      },
    );
    const result = rankDiscoveryCandidates([steady, cooling], "cooling", 7, now);
    expect(result.map((entry) => entry.repository.fullName)).toEqual(["large/cooling"]);
    expect(result[0]?.evidence[0]).toMatch(/Momentum slowed relative/);
  });
});
