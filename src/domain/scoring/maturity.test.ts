import { describe, expect, it } from "vitest";

import { classifyMaturity } from "./maturity";

describe("project maturity classification", () => {
  it("classifies measurable lifecycle states", () => {
    expect(
      classifyMaturity({
        ageDays: null,
        daysSinceLastCommit: 2,
        activeWeeks12: 12,
        growth30d: null,
        previousDormantPeriodDays: null,
      }),
    ).toBeNull();
    expect(
      classifyMaturity({
        ageDays: 30,
        daysSinceLastCommit: 2,
        activeWeeks12: 1,
        growth30d: 0,
        previousDormantPeriodDays: null,
      }),
    ).toBe("NEW");
    expect(
      classifyMaturity({
        ageDays: 45,
        daysSinceLastCommit: 2,
        activeWeeks12: 5,
        growth30d: 200,
        previousDormantPeriodDays: null,
      }),
    ).toBe("EMERGING");
    expect(
      classifyMaturity({
        ageDays: 700,
        daysSinceLastCommit: 5,
        activeWeeks12: 8,
        growth30d: 100,
        previousDormantPeriodDays: null,
      }),
    ).toBe("GROWING");
    expect(
      classifyMaturity({
        ageDays: 2400,
        daysSinceLastCommit: 10,
        activeWeeks12: 5,
        growth30d: 0,
        previousDormantPeriodDays: null,
      }),
    ).toBe("MATURE");
    expect(
      classifyMaturity({
        ageDays: 800,
        daysSinceLastCommit: 450,
        activeWeeks12: 0,
        growth30d: 0,
        previousDormantPeriodDays: null,
      }),
    ).toBe("DORMANT");
    expect(
      classifyMaturity({
        ageDays: 900,
        daysSinceLastCommit: 3,
        activeWeeks12: 6,
        growth30d: 40,
        previousDormantPeriodDays: 260,
      }),
    ).toBe("REVIVED");
  });
});
