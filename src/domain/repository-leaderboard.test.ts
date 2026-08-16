import { describe, expect, it } from "vitest";

import {
  calculateRepositoryLeaderboardGrowth,
  normalizeRepositoryLeaderboardRequest,
  repositoryAgeRange,
  repositoryStarRange,
  repositoryStatusMaturities,
} from "./repository-leaderboard";

const asOf = new Date("2026-08-16T00:00:00.000Z");
const observation = (daysAgo: number, stars: number | null) => ({
  observedAt: new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1_000),
  stars,
});

describe("repository leaderboard", () => {
  it("normalizes every shareable filter and rejects malformed values", () => {
    expect(
      normalizeRepositoryLeaderboardRequest({
        q: "  frontend  ",
        language: "TypeScript",
        sort: "growth",
        period: "30d",
        stars: "1k-5k",
        age: "1-3",
        status: "active",
        forks: "include",
        page: "4",
      }),
    ).toEqual({
      query: "frontend",
      language: "TypeScript",
      sort: "growth",
      period: "30d",
      stars: "1k-5k",
      age: "1-3",
      status: "active",
      includeForks: true,
      page: 4,
    });
    expect(
      normalizeRepositoryLeaderboardRequest({
        language: "../../bad",
        sort: "unknown",
        period: ["30d"],
        page: "NaN",
      }),
    ).toMatchObject({ language: undefined, sort: "score", period: "7d", page: 1 });
  });

  it("defines non-overlapping star bands and explicit age/status cohorts", () => {
    expect(repositoryStarRange("under-1k")).toEqual({ minimum: 0, maximumExclusive: 1_000 });
    expect(repositoryStarRange("100k-plus")).toEqual({ minimum: 100_000 });
    expect(repositoryAgeRange("1-3")).toEqual({
      minimumDays: 365,
      maximumDaysExclusive: 1_095,
    });
    expect(repositoryStatusMaturities("stable")).toEqual(["ESTABLISHED", "MATURE"]);
  });

  it("uses a real boundary baseline and discloses its observed span", () => {
    expect(
      calculateRepositoryLeaderboardGrowth(
        [observation(40, 1_000), observation(20, 1_050), observation(0, 1_110)],
        "30d",
        asOf,
      ),
    ).toEqual({
      absolute: 110,
      confidence: "LOW",
      observationCount: 3,
      historySpanDays: 40,
      anomaly: null,
    });
  });

  it("withholds stale, excessively distant, and decreasing windows", () => {
    expect(
      calculateRepositoryLeaderboardGrowth(
        [observation(40, 1_000), observation(20, 1_050)],
        "7d",
        asOf,
      ).absolute,
    ).toBeNull();
    expect(
      calculateRepositoryLeaderboardGrowth(
        [observation(100, 1_000), observation(0, 1_100)],
        "30d",
        asOf,
      ).absolute,
    ).toBeNull();
    expect(
      calculateRepositoryLeaderboardGrowth(
        [observation(31, 1_100), observation(0, 1_000)],
        "30d",
        asOf,
      ),
    ).toMatchObject({ absolute: null, confidence: "LOW", anomaly: expect.any(String) });
  });
});
