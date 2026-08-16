import { describe, expect, it } from "vitest";

import { planSnapshotRetention, type SnapshotRetentionCandidate } from "./snapshot-retention";

const now = new Date("2026-08-16T12:00:00.000Z");
const snapshot = (
  id: string,
  entityKey: string,
  observedAt: string,
): SnapshotRetentionCandidate => ({ id, entityKey, observedAt: new Date(observedAt) });

describe("planSnapshotRetention", () => {
  it("keeps every observation inside the recent full-resolution window", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("a", "repo", "2026-08-16T01:00:00Z"),
        snapshot("b", "repo", "2026-08-16T02:00:00Z"),
        snapshot("c", "repo", "2026-05-19T12:00:00Z"),
      ],
      now,
    );
    expect(plan.removedIds).toEqual([]);
    expect(plan.keptByTier.recent).toBe(3);
  });

  it("keeps the newest observation per UTC day between 90 days and one year", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("older", "repo", "2026-04-01T01:00:00Z"),
        snapshot("newer", "repo", "2026-04-01T22:00:00Z"),
        snapshot("next-day", "repo", "2026-04-02T01:00:00Z"),
      ],
      now,
    );
    expect(plan.keptIds).toEqual(["next-day", "newer"]);
    expect(plan.removedIds).toEqual(["older"]);
  });

  it("keeps the newest observation per UTC week after one year", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("monday", "repo", "2025-01-06T12:00:00Z"),
        snapshot("friday", "repo", "2025-01-10T12:00:00Z"),
        snapshot("prior-week", "repo", "2025-01-03T12:00:00Z"),
      ],
      now,
    );
    expect(plan.keptIds).toEqual(["friday", "prior-week"]);
    expect(plan.removedIds).toEqual(["monday"]);
    expect(plan.keptByTier.weekly).toBe(2);
  });

  it("downsamples each entity independently", () => {
    const plan = planSnapshotRetention(
      [
        snapshot("a1", "a", "2026-04-01T01:00:00Z"),
        snapshot("a2", "a", "2026-04-01T02:00:00Z"),
        snapshot("b1", "b", "2026-04-01T01:00:00Z"),
        snapshot("b2", "b", "2026-04-01T02:00:00Z"),
      ],
      now,
    );
    expect(plan.keptIds).toEqual(["a2", "b2"]);
    expect(plan.removedIds).toEqual(["a1", "b1"]);
  });
});
