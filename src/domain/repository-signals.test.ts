import { describe, expect, it } from "vitest";

import { deriveRepositorySignals, type RepositorySignalInput } from "./repository-signals";

const now = new Date("2026-08-16T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1_000;

const complete: RepositorySignalInput = {
  maturity: "GROWING",
  momentum: 62.4,
  snapshotCount: 5,
  activeWeeks12: 10,
  latestCommitAt: new Date(now.getTime() - 3 * DAY_MS),
  uniqueAuthors90d: 8,
  topContributorShare: 0.32,
  tagCount: 24,
  qualitySignals: { readme: true, license: true, tests: true, ci: true, docker: false },
};

describe("repository signals", () => {
  it("derives factual positive signals from complete evidence", () => {
    const signals = deriveRepositorySignals(complete, now);
    expect(signals.map((signal) => signal.key)).toEqual([
      "maintained",
      "distributed-authorship",
      "lifecycle-growth",
      "observed-momentum",
      "repository-structures",
      "git-tags",
    ]);
    expect(signals.find((signal) => signal.key === "observed-momentum")?.detail).toContain(
      "5 persisted",
    );
  });

  it("labels concentration as an estimate and avoids an exact bus-factor claim", () => {
    const signal = deriveRepositorySignals(
      { ...complete, uniqueAuthors90d: 3, topContributorShare: 0.72 },
      now,
    ).find((entry) => entry.key === "contributor-concentration");
    expect(signal).toMatchObject({ status: "Top author 72%", tone: "CAUTION" });
    expect(signal?.detail).toContain("not an exact bus factor");
  });

  it("withholds unavailable evidence instead of manufacturing a signal", () => {
    expect(
      deriveRepositorySignals(
        {
          maturity: null,
          momentum: null,
          snapshotCount: 0,
          activeWeeks12: null,
          latestCommitAt: null,
          uniqueAuthors90d: null,
          topContributorShare: null,
          tagCount: null,
          qualitySignals: null,
        },
        now,
      ),
    ).toEqual([]);
  });
});
