import { describe, expect, it } from "vitest";

import { calculatePreviousDormantPeriodDays, GIT_ACTIVITY_THRESHOLDS } from "./git-activity";

const asOf = new Date("2026-08-16T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1_000;
const daysAgo = (days: number) => new Date(asOf.getTime() - days * DAY_MS);

describe("bounded Git activity gaps", () => {
  it("returns the most recent measured 180-day quiet interval before renewed activity", () => {
    expect(
      calculatePreviousDormantPeriodDays(
        [daysAgo(5), daysAgo(15), daysAgo(30), daysAgo(40), daysAgo(250)],
        asOf,
      ),
    ).toBe(210);
  });

  it("does not publish an old quiet interval as a current revival signal", () => {
    expect(
      calculatePreviousDormantPeriodDays(
        [daysAgo(1), daysAgo(100), daysAgo(200), daysAgo(450)],
        asOf,
      ),
    ).toBeNull();
  });

  it("accepts the exact threshold and ignores duplicate, invalid, and future dates", () => {
    expect(
      calculatePreviousDormantPeriodDays(
        [
          daysAgo(10),
          daysAgo(190),
          daysAgo(190),
          new Date("invalid"),
          new Date(asOf.getTime() + DAY_MS),
        ],
        asOf,
      ),
    ).toBe(GIT_ACTIVITY_THRESHOLDS.revivalQuietDays);
  });

  it("withholds the metric until two bounded commit dates exist", () => {
    expect(calculatePreviousDormantPeriodDays([daysAgo(2)], asOf)).toBeNull();
  });
});
