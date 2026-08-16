import { describe, expect, it } from "vitest";

import { calculateTrend, selectTrendWindowObservations } from "./trending";

const observations = (values: number[]) =>
  values.map((stars, index) => ({
    observedAt: new Date(Date.UTC(2026, 7, index + 1)),
    stars,
    forks: null,
  }));

describe("trending v1", () => {
  it("distinguishes absolute growth from relative growth", () => {
    const tenThousand = calculateTrend(observations([10_000, 10_400, 11_000]), 3);
    const hundredThousand = calculateTrend(observations([100_000, 100_100, 100_200]), 3);
    const breakout = calculateTrend(observations([500, 700, 1_200]), 3);
    expect(tenThousand.absoluteGrowth).toBe(1_000);
    expect(breakout.percentageGrowth).toBe(140);
    expect(breakout.score).toBeGreaterThan(hundredThousand.score ?? 0);
  });

  it("flags a counter decrease instead of publishing negative growth", () => {
    const result = calculateTrend(observations([50_000, 50_050, 49_900]), 3);
    expect(result.absoluteGrowth).toBeNull();
    expect(result.score).toBeNull();
    expect(result.anomaly).toMatch(/decreased/);
  });

  it("reports insufficient history honestly", () => {
    expect(calculateTrend(observations([500]), 7)).toMatchObject({
      score: null,
      confidence: "INSUFFICIENT",
    });
  });

  it("uses one real pre-window baseline and excludes future observations", () => {
    const asOf = new Date("2026-08-16T12:00:00.000Z");
    const values = [
      { observedAt: new Date("2026-07-01T12:00:00.000Z"), stars: 100, forks: null },
      { observedAt: new Date("2026-07-16T12:00:00.000Z"), stars: 120, forks: null },
      { observedAt: new Date("2026-08-01T12:00:00.000Z"), stars: 140, forks: null },
      { observedAt: new Date("2026-08-16T12:00:00.000Z"), stars: 180, forks: null },
      { observedAt: new Date("2026-08-17T12:00:00.000Z"), stars: 999, forks: null },
    ];
    expect(
      selectTrendWindowObservations(values, 30, asOf).map((observation) => observation.stars),
    ).toEqual([120, 140, 180]);
  });
});
