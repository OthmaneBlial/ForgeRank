import { describe, expect, it } from "vitest";

import { assessWorkerHeartbeat } from "./system-health";

const now = new Date("2026-08-16T12:00:00.000Z");

describe("worker heartbeat health", () => {
  it("distinguishes missing, fresh, stale, and stopping workers", () => {
    expect(assessWorkerHeartbeat(null, now)).toEqual({ state: "missing", ageSeconds: null });
    expect(
      assessWorkerHeartbeat(
        { updatedAt: new Date("2026-08-16T11:59:30.000Z"), reportedStatus: "RUNNING" },
        now,
      ),
    ).toEqual({ state: "healthy", ageSeconds: 30 });
    expect(
      assessWorkerHeartbeat(
        { updatedAt: new Date("2026-08-16T11:57:00.000Z"), reportedStatus: "RUNNING" },
        now,
      ),
    ).toEqual({ state: "stale", ageSeconds: 180 });
    expect(
      assessWorkerHeartbeat(
        { updatedAt: new Date("2026-08-16T11:59:55.000Z"), reportedStatus: "STOPPING" },
        now,
      ),
    ).toEqual({ state: "stopping", ageSeconds: 5 });
  });
});
