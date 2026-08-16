import { describe, expect, it } from "vitest";

import { formatBytes, formatObservationAge } from "./format";

describe("formatObservationAge", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("does not imply an observation when none exists", () => {
    expect(formatObservationAge(null, now)).toBe("Awaiting first observation");
  });

  it("uses concise minute, hour, and day labels", () => {
    expect(formatObservationAge(new Date("2026-08-15T11:42:00.000Z"), now)).toBe("Updated 18m ago");
    expect(formatObservationAge(new Date("2026-08-15T04:00:00.000Z"), now)).toBe("Updated 8h ago");
    expect(formatObservationAge(new Date("2026-08-12T12:00:00.000Z"), now)).toBe("Updated 3d ago");
  });
});

describe("formatBytes", () => {
  it("uses readable binary units without inventing precision", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1_572_864)).toBe("1.5 MiB");
    expect(formatBytes(null)).toBe("Unavailable");
  });
});
