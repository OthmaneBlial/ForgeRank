import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { enforceGitCacheQuota, removeGitCacheRepository } from "./cache-manager";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("Git cache quota", () => {
  it("evicts the oldest inactive repository and preserves an explicit target", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forgerank-git-cache-"));
    temporaryRoots.push(root);
    const oldRepository = path.join(root, "github.com", "old", "project.git");
    const protectedRepository = path.join(root, "github.com", "active", "project.git");
    await mkdir(oldRepository, { recursive: true });
    await mkdir(protectedRepository, { recursive: true });
    await writeFile(path.join(oldRepository, "pack"), "x".repeat(80));
    await writeFile(path.join(protectedRepository, "pack"), "x".repeat(80));
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(oldRepository, old, old);

    const report = await enforceGitCacheQuota(root, 100, [protectedRepository]);

    expect(report.removed).toEqual([path.join("github.com", "old", "project.git")]);
    expect(report.overLimit).toBe(false);
  });

  it("refuses deletion outside the cache repository layout", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "forgerank-git-cache-"));
    temporaryRoots.push(root);
    await expect(removeGitCacheRepository(root, path.join(root, "..", "unsafe"))).rejects.toThrow(
      "Refusing",
    );
  });
});
