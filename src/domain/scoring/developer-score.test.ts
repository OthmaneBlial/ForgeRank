import { describe, expect, it } from "vitest";

import { calculateDeveloperScore, deriveDeveloperScoreConfidence } from "./developer-score";

describe("developer score v1", () => {
  it("scores only available public project evidence", () => {
    const result = calculateDeveloperScore({
      ownedOriginalStars: 50_000,
      ownedRepositoryCount: 4,
      averageRepositoryScore: 72,
      activeOwnedRepositoryCount: 3,
      collaborationRepositoryCount: null,
      activeMonths12: 10,
      languageCount: 3,
      confidence: "HIGH",
    });
    expect(result.total).toBeGreaterThan(50);
    expect(result.collaboration).toBe(0);
    expect(result.reasons).toContain("Confirmed collaboration evidence is unavailable");
  });

  it("reduces incomplete profile evidence", () => {
    const high = calculateDeveloperScore({
      ownedOriginalStars: 2_000,
      ownedRepositoryCount: 1,
      averageRepositoryScore: 60,
      activeOwnedRepositoryCount: 1,
      collaborationRepositoryCount: null,
      activeMonths12: null,
      languageCount: 1,
      confidence: "HIGH",
    });
    const low = calculateDeveloperScore({
      ownedOriginalStars: 2_000,
      ownedRepositoryCount: 1,
      averageRepositoryScore: 60,
      activeOwnedRepositoryCount: 1,
      collaborationRepositoryCount: null,
      activeMonths12: null,
      languageCount: 1,
      confidence: "LOW",
    });
    expect(low.total).toBeLessThan(high.total);
    expect(low.trust).toBeLessThan(high.trust);
  });

  it("does not call a one-repository partial portfolio high confidence", () => {
    expect(
      deriveDeveloperScoreConfidence({
        ownedRepositoryCount: 1,
        activeMonths12: null,
        collaborationRepositoryCount: null,
        confidence: "HIGH",
      }),
    ).toBe("LOW");
    expect(
      deriveDeveloperScoreConfidence({
        ownedRepositoryCount: 0,
        activeMonths12: null,
        collaborationRepositoryCount: null,
        confidence: "HIGH",
      }),
    ).toBe("INSUFFICIENT");
  });
});
