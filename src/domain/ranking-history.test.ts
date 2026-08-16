import { describe, expect, it } from "vitest";

import {
  summarizeRankMovement,
  summarizeRankMovementWindows,
  type RankHistoryPoint,
} from "./ranking-history";

const now = new Date("2026-08-16T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1_000;

function point(daysAgo: number, rank: number): RankHistoryPoint {
  return {
    calculatedAt: new Date(now.getTime() - daysAgo * DAY_MS),
    rank,
    score: 70,
    rankingVersion: "repository-ranking-v1",
  };
}

describe("ranking history", () => {
  it("uses the latest completed ranking at or before each requested baseline", () => {
    const points = [point(35, 12), point(8, 9), point(2, 7), point(0, 5)];
    expect(summarizeRankMovement(points, 7, now)).toMatchObject({
      fromRank: 9,
      toRank: 5,
      places: 4,
      direction: "UP",
      observedSpanDays: 8,
    });
    expect(summarizeRankMovement(points, 30, now)).toMatchObject({
      fromRank: 12,
      toRank: 5,
      places: 7,
      direction: "UP",
      observedSpanDays: 35,
    });
  });

  it("distinguishes downward and unchanged movement", () => {
    expect(summarizeRankMovement([point(8, 3), point(0, 6)], 7, now)).toMatchObject({
      places: 3,
      direction: "DOWN",
    });
    expect(summarizeRankMovement([point(8, 4), point(0, 4)], 7, now)).toMatchObject({
      places: 0,
      direction: "UNCHANGED",
    });
  });

  it("withholds movement when a requested baseline does not exist", () => {
    const windows = summarizeRankMovementWindows([point(0, 4)], now);
    expect(windows.map((window) => window.movement)).toEqual([null, null, null]);
  });
});
