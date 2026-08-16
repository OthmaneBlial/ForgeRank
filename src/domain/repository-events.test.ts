import { describe, expect, it } from "vitest";

import type { Confidence } from "./confidence";
import {
  deriveRepositoryEvents,
  REPOSITORY_EVENT_VERSION,
  type RepositoryEventGitAnalysis,
  type RepositoryEventRank,
  type RepositoryEventSnapshot,
} from "./repository-events";

const origin = new Date("2026-08-16T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1_000;
const at = (days: number) => new Date(origin.getTime() + days * DAY_MS);
const snapshot = (
  days: number,
  stars: number | null,
  overrides: Partial<RepositoryEventSnapshot> = {},
): RepositoryEventSnapshot => ({
  observedAt: at(days),
  stars,
  momentumScore: null,
  scoreVersion: null,
  anomalyFlags: [],
  confidence: "HIGH" as Confidence,
  ...overrides,
});

describe("repository historical events", () => {
  it("records tracking and observed threshold crossings without backfilling prior milestones", () => {
    const events = deriveRepositoryEvents({
      snapshots: [snapshot(0, 900), snapshot(1, 1_100), snapshot(2, 10_200)],
      ranks: [],
      gitAnalyses: [],
    });
    expect(
      events.filter((event) => event.kind === "STAR_MILESTONE").map((event) => event.title),
    ).toEqual([
      "10k observed-star milestone",
      "5k observed-star milestone",
      "1k observed-star milestone",
    ]);
    expect(events.at(-1)?.kind).toBe("TRACKING_STARTED");
    expect(events.every((event) => event.version === REPOSITORY_EVENT_VERSION)).toBe(true);

    const alreadyLarge = deriveRepositoryEvents({
      snapshots: [snapshot(0, 20_000)],
      ranks: [],
      gitAnalyses: [],
    });
    expect(alreadyLarge.map((event) => event.kind)).toEqual(["TRACKING_STARTED"]);
  });

  it("rejects anomalous counter crossings and score comparisons across versions", () => {
    const events = deriveRepositoryEvents({
      snapshots: [
        snapshot(0, 900, { momentumScore: 4, scoreVersion: "v1" }),
        snapshot(1, 1_100, {
          momentumScore: 12,
          scoreVersion: "v2",
          anomalyFlags: ["counter review"],
        }),
      ],
      ranks: [],
      gitAnalyses: [],
    });
    expect(events.map((event) => event.kind)).toEqual(["TRACKING_STARTED"]);
  });

  it("derives momentum and Top-100/50 entries only from comparable completed versions", () => {
    const ranks: RepositoryEventRank[] = [
      { calculatedAt: at(0), rank: 140, rankingVersion: "rank-v1" },
      { calculatedAt: at(1), rank: 80, rankingVersion: "rank-v1" },
      { calculatedAt: at(2), rank: 40, rankingVersion: "rank-v1" },
      { calculatedAt: at(3), rank: 5, rankingVersion: "rank-v2" },
    ];
    const events = deriveRepositoryEvents({
      snapshots: [
        snapshot(0, 1_000, { momentumScore: 5, scoreVersion: "repository-v1" }),
        snapshot(1, 1_100, { momentumScore: 10, scoreVersion: "repository-v1" }),
      ],
      ranks,
      gitAnalyses: [],
    });
    expect(
      events.filter((event) => event.kind === "RANK_MILESTONE").map((event) => event.title),
    ).toEqual(["Entered the ForgeRank Top 50", "Entered the ForgeRank Top 100"]);
    expect(events.some((event) => event.kind === "MOMENTUM_INCREASED")).toBe(true);
  });

  it("derives tag, revival, and later dormancy transitions from bounded Git analyses", () => {
    const analyses: RepositoryEventGitAnalysis[] = [
      {
        analyzedAt: at(0),
        latestCommitAt: at(-5),
        activeWeeks12: 2,
        previousDormantPeriodDays: null,
        tagCount: 5,
      },
      {
        analyzedAt: at(10),
        latestCommitAt: at(8),
        activeWeeks12: 7,
        previousDormantPeriodDays: 210,
        tagCount: 8,
      },
      {
        analyzedAt: at(400),
        latestCommitAt: at(8),
        activeWeeks12: 0,
        previousDormantPeriodDays: null,
        tagCount: 8,
      },
    ];
    const events = deriveRepositoryEvents({ snapshots: [], ranks: [], gitAnalyses: analyses });
    expect(events.map((event) => event.kind)).toEqual([
      "DORMANCY_OBSERVED",
      "ACTIVITY_RESUMED",
      "NEW_TAGS_OBSERVED",
    ]);
    expect(events.find((event) => event.kind === "ACTIVITY_RESUMED")?.confidence).toBe("MEDIUM");
    expect(events.find((event) => event.kind === "NEW_TAGS_OBSERVED")?.detail).toMatch(
      /not automatically labeled releases/,
    );
  });
});
