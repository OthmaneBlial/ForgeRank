import { describe, expect, it } from "vitest";

import {
  REFRESH_INTERVAL_MS,
  calculateRefreshPriority,
  classifyRefreshTier,
  decideRepositoryRefresh,
  type RefreshPolicyInput,
} from "./refresh-policy";

const now = new Date("2026-08-15T12:00:00.000Z");
const day = 24 * 60 * 60 * 1_000;

const baseline = (overrides: Partial<RefreshPolicyInput> = {}): RefreshPolicyInput => ({
  state: "ACTIVE",
  maturity: "ESTABLISHED",
  stars: 900,
  momentum: null,
  lastActivityAt: new Date(now.getTime() - 80 * day),
  lastSuccessfulFetchAt: new Date(now.getTime() - day),
  lastRefreshCompletedAt: new Date(now.getTime() - day),
  collectionCount: 0,
  pageViewCount: 0,
  lastViewedAt: null,
  refreshRequestCount: 0,
  lastRefreshRequestedAt: null,
  ...overrides,
});

describe("repository refresh policy", () => {
  it("classifies high-momentum, active projects as hot", () => {
    expect(
      classifyRefreshTier(
        baseline({ momentum: 72, lastActivityAt: new Date(now.getTime() - day) }),
        now,
      ),
    ).toBe("HOT");
  });

  it("keeps curated or recently active repositories on the active cadence", () => {
    expect(classifyRefreshTier(baseline({ collectionCount: 1 }), now)).toBe("ACTIVE");
    expect(
      classifyRefreshTier(baseline({ lastActivityAt: new Date(now.getTime() - 20 * day) }), now),
    ).toBe("ACTIVE");
  });

  it("sends dormant and unavailable repositories to the cold cadence", () => {
    expect(classifyRefreshTier(baseline({ maturity: "DORMANT" }), now)).toBe("COLD");
    expect(classifyRefreshTier(baseline({ state: "UNAVAILABLE" }), now)).toBe("COLD");
  });

  it("marks a repository due only after its tier interval", () => {
    const notDue = decideRepositoryRefresh(
      baseline({
        lastSuccessfulFetchAt: new Date(now.getTime() - 2 * day),
        lastRefreshCompletedAt: new Date(now.getTime() - 2 * day),
      }),
      now,
    );
    const due = decideRepositoryRefresh(
      baseline({
        lastSuccessfulFetchAt: new Date(now.getTime() - 4 * day),
        lastRefreshCompletedAt: new Date(now.getTime() - 4 * day),
      }),
      now,
    );
    expect(notDue.tier).toBe("NORMAL");
    expect(notDue.due).toBe(false);
    expect(notDue.nextRefreshAt.getTime()).toBe(
      now.getTime() - 2 * day + REFRESH_INTERVAL_MS.NORMAL,
    );
    expect(due.due).toBe(true);
  });

  it("makes first observations and pending user requests due immediately", () => {
    expect(
      decideRepositoryRefresh(
        baseline({ lastSuccessfulFetchAt: null, lastRefreshCompletedAt: null }),
        now,
      ).due,
    ).toBe(true);
    const requested = decideRepositoryRefresh(
      baseline({ lastRefreshRequestedAt: new Date(now.getTime() - 1_000), refreshRequestCount: 1 }),
      now,
    );
    expect(requested.due).toBe(true);
    expect(requested.reasons).toContain("pending user refresh request");
  });

  it("does not keep an already-served refresh request pending", () => {
    const input = baseline({
      lastRefreshRequestedAt: new Date(now.getTime() - 2 * day),
      lastSuccessfulFetchAt: new Date(now.getTime() - day),
      lastRefreshCompletedAt: new Date(now.getTime() - day),
      refreshRequestCount: 8,
    });
    const priority = calculateRefreshPriority(input, classifyRefreshTier(input, now), now);
    expect(priority.reasons).not.toContain("pending user refresh request");
  });

  it("bounds priority and records every applied factor", () => {
    const decision = decideRepositoryRefresh(
      baseline({
        stars: 1_000_000,
        momentum: 100,
        collectionCount: 3,
        pageViewCount: 10_000,
        lastViewedAt: now,
        refreshRequestCount: 100,
        lastRefreshRequestedAt: now,
        lastActivityAt: now,
        lastSuccessfulFetchAt: new Date(now.getTime() - 30 * day),
        lastRefreshCompletedAt: new Date(now.getTime() - 30 * day),
      }),
      now,
    );
    expect(decision.priority).toBe(100);
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        "snapshot staleness",
        "curated collection membership",
        "observed popularity",
        "observed momentum",
        "repository page interest",
        "pending user refresh request",
        "recent Git activity",
      ]),
    );
  });

  it("treats a completed cache-backed refresh as serving an earlier request", () => {
    const completedAt = new Date(now.getTime() - 10 * 60 * 1_000);
    const decision = decideRepositoryRefresh(
      baseline({
        lastSuccessfulFetchAt: new Date(now.getTime() - 3 * day),
        lastRefreshRequestedAt: new Date(now.getTime() - 20 * 60 * 1_000),
        lastRefreshCompletedAt: completedAt,
        refreshRequestCount: 1,
      }),
      now,
    );
    expect(decision.due).toBe(false);
    expect(decision.nextRefreshAt.getTime()).toBe(
      completedAt.getTime() + REFRESH_INTERVAL_MS.NORMAL,
    );
  });
});
