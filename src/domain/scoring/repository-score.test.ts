import { describe, expect, it } from "vitest";

import { calculateRepositoryScore, type RepositoryScoreSignals } from "./repository-score";

const healthy: RepositoryScoreSignals = {
  stars: 8_000,
  forks: 900,
  ageDays: 800,
  starGrowth30d: 750,
  starGrowthPrevious30d: 430,
  activeWeeks12: 11,
  daysSinceLastCommit: 2,
  uniqueAuthors90d: 18,
  topContributorShare: 0.28,
  hasReadme: true,
  hasLicense: true,
  hasTests: true,
  hasCi: true,
  isFork: false,
  isArchived: false,
  anomalyCount: 0,
  confidence: "HIGH",
};

describe("repository score v1", () => {
  it("rewards a small healthy growing project across dimensions", () => {
    const score = calculateRepositoryScore(healthy);
    expect(score.total).toBeGreaterThan(65);
    expect(score.momentum).toBeGreaterThan(8);
    expect(score.health).toBeGreaterThan(15);
    expect(score.reasons).toContainEqual(
      expect.objectContaining({ dimension: "health", tone: "POSITIVE" }),
    );
    expect(score.reasons).toHaveLength(6);
  });

  it("does not let a dormant giant dominate on historical stars", () => {
    const dormant = calculateRepositoryScore({
      ...healthy,
      stars: 250_000,
      forks: 30_000,
      starGrowth30d: 5,
      starGrowthPrevious30d: 8,
      activeWeeks12: 0,
      daysSinceLastCommit: 600,
      uniqueAuthors90d: 0,
      topContributorShare: 1,
      hasTests: null,
      hasCi: null,
    });
    const growing = calculateRepositoryScore(healthy);
    expect(growing.total).toBeGreaterThan(dormant.total);
    expect(dormant.impact).toBeGreaterThan(growing.impact);
    expect(dormant.health).toBeLessThan(growing.health);
  });

  it("reduces low-confidence and anomalous scores", () => {
    const trusted = calculateRepositoryScore(healthy);
    const tentative = calculateRepositoryScore({ ...healthy, confidence: "LOW", anomalyCount: 2 });
    expect(tentative.total).toBeLessThan(trusted.total);
    expect(tentative.trust).toBeLessThan(trusted.trust);
    expect(tentative.reasons).toContainEqual(
      expect.objectContaining({
        dimension: "trust",
        tone: "CAUTION",
        summary: "Trust deductions apply to this calculation",
      }),
    );
  });

  it("does not invent dimensions when evidence is absent", () => {
    const empty = calculateRepositoryScore({
      stars: null,
      forks: null,
      ageDays: null,
      starGrowth30d: null,
      starGrowthPrevious30d: null,
      activeWeeks12: null,
      daysSinceLastCommit: null,
      uniqueAuthors90d: null,
      topContributorShare: null,
      hasReadme: null,
      hasLicense: null,
      hasTests: null,
      hasCi: null,
      isFork: null,
      isArchived: false,
      anomalyCount: 0,
      confidence: "INSUFFICIENT",
    });
    expect(empty.impact).toBe(0);
    expect(empty.momentum).toBe(0);
    expect(empty.health).toBe(0);
    expect(empty.community).toBe(0);
    expect(empty.engineering).toBe(0);
    expect(empty.reasons).toHaveLength(6);
    expect(empty.reasons).toContainEqual(
      expect.objectContaining({
        dimension: "momentum",
        tone: "MISSING",
        summary: "Momentum needs more observed history",
      }),
    );
    expect(empty.reasons).toContainEqual(
      expect.objectContaining({
        dimension: "trust",
        tone: "MISSING",
        summary: "Additional observations are required",
      }),
    );
  });

  it("explains fork and archive trust deductions without turning them into quality claims", () => {
    const score = calculateRepositoryScore({
      ...healthy,
      isFork: true,
      isArchived: true,
      anomalyCount: 1,
    });
    const trust = score.reasons.find((reason) => reason.dimension === "trust");
    expect(trust).toMatchObject({
      tone: "CAUTION",
      summary: "Trust deductions apply to this calculation",
    });
    expect(trust?.detail).toContain("fork status");
    expect(trust?.detail).toContain("archived status");
    expect(trust?.detail).toContain("1 low-confidence anomaly signal");
  });
});
