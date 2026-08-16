import { createHash } from "node:crypto";
import { access, mkdir, utimes } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { analyzeReadme, README_ANALYSIS_LIMITS, selectReadmePath } from "@/domain/readme-analysis";
import {
  detectPrimaryLanguage,
  detectQualitySignals,
  detectTechnologies,
} from "@/domain/technology/analyze-tree";
import { calculatePreviousDormantPeriodDays } from "@/domain/git-activity";
import { getDatabase } from "@/infrastructure/db/client";
import { gitAnalyses, repositories, repositoryContributors } from "@/infrastructure/db/schema";
import { getRepository } from "@/infrastructure/db/repository-store";
import { parseGitHubRepositoryInput } from "@/infrastructure/github-public/url";

import { GitInspectionError, runGit, runGitLines } from "./safe-git";
import {
  enforceGitCacheQuota,
  gitCacheLimitBytes,
  removeGitCacheRepository,
} from "./cache-manager";

export const GIT_ANALYSIS_VERSION = "git-analysis-v3";
const MAX_MANIFEST_BYTES = 512 * 1024;
const manifestCandidates = [
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
];
const locks = new Map<string, Promise<GitInspectionResult>>();

export type GitInspectionResult = {
  repositoryId: string;
  fullName: string;
  strategy: string;
  primaryLanguage: string | null;
  commits90d: number;
  previousDormantPeriodDays: number | null;
  uniqueAuthors90d: number;
  technologies: string[];
  treeTruncated: boolean;
};

export class GitInspector {
  async inspect(input: string): Promise<GitInspectionResult> {
    const identity = parseGitHubRepositoryInput(input);
    const existing = locks.get(identity.fullName.toLowerCase());
    if (existing) return existing;
    const task = this.inspectUnlocked(identity.fullName, identity.sourceUrl).finally(() =>
      locks.delete(identity.fullName.toLowerCase()),
    );
    locks.set(identity.fullName.toLowerCase(), task);
    return task;
  }

  private async inspectUnlocked(fullName: string, sourceUrl: string): Promise<GitInspectionResult> {
    const known = await getRepository(...(fullName.split("/") as [string, string]));
    if (!known)
      throw new GitInspectionError(`${fullName} must be discovered before Git inspection.`);
    const cacheRoot =
      process.env.GIT_CACHE_DIR ??
      path.join(process.env.FORGERANK_DATA_DIR ?? path.join(process.cwd(), "data"), "git-cache");
    const [owner = "", name = ""] = fullName.split("/");
    const repositoryPath = path.join(
      cacheRoot,
      "github.com",
      owner.toLowerCase(),
      `${name.toLowerCase()}.git`,
    );
    await mkdir(path.dirname(repositoryPath), { recursive: true });
    const maximumCacheBytes = gitCacheLimitBytes();
    await enforceGitCacheQuota(cacheRoot, maximumCacheBytes, [repositoryPath]);

    let strategy = "incremental-shallow-fetch";
    if (!(await exists(path.join(repositoryPath, "HEAD")))) {
      strategy = "shallow-blobless-clone";
      await runGit(
        [
          "clone",
          "--bare",
          "--filter=blob:none",
          "--depth=500",
          "--single-branch",
          sourceUrl,
          repositoryPath,
        ],
        { timeoutMs: 120_000, maxBufferBytes: 2 * 1024 * 1024 },
      );
    } else {
      await runGit(["--git-dir", repositoryPath, "fetch", "--quiet", "--depth=500", "origin"], {
        timeoutMs: 120_000,
      });
    }
    const quota = await enforceGitCacheQuota(cacheRoot, maximumCacheBytes, [repositoryPath]);
    if (quota.overLimit) {
      await removeGitCacheRepository(cacheRoot, repositoryPath);
      throw new GitInspectionError(
        "The Git cache quota would be exceeded by this repository, so its temporary clone was removed.",
      );
    }

    const logOutput = await runGit(
      [
        "--git-dir",
        repositoryPath,
        "log",
        "-n",
        "10000",
        "--since=730 days ago",
        "--format=%aN%x1f%aI",
        "HEAD",
      ],
      { maxBufferBytes: 12 * 1024 * 1024 },
    );
    const commits = logOutput
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [author = "Unknown Git author", iso = ""] = line.split("\x1f");
        return { author: sanitizeAuthor(author), date: new Date(iso) };
      })
      .filter((entry) => !Number.isNaN(entry.date.getTime()));
    const now = Date.now();
    const commits90d = commits.filter((commit) => now - commit.date.getTime() <= 90 * 86_400_000);
    const human90d = commits90d.filter((commit) => !isBotAuthor(commit.author));
    const authorCounts = new Map<
      string,
      { displayName: string; count: number; first: Date; last: Date }
    >();
    for (const commit of human90d) {
      const key = createHash("sha256").update(commit.author.toLowerCase()).digest("hex");
      const current = authorCounts.get(key);
      authorCounts.set(
        key,
        current
          ? {
              ...current,
              count: current.count + 1,
              first: commit.date < current.first ? commit.date : current.first,
              last: commit.date > current.last ? commit.date : current.last,
            }
          : { displayName: commit.author, count: 1, first: commit.date, last: commit.date },
      );
    }
    const sortedAuthors = [...authorCounts.entries()].sort((a, b) => b[1].count - a[1].count);
    const humanCommitTotal = Math.max(1, human90d.length);
    const topContributorShare = sortedAuthors[0]?.[1].count
      ? sortedAuthors[0][1].count / humanCommitTotal
      : null;
    const topThreeContributorShare =
      sortedAuthors.slice(0, 3).reduce((sum, [, author]) => sum + author.count, 0) /
      humanCommitTotal;
    const concentrationIndex = sortedAuthors.reduce(
      (sum, [, author]) => sum + (author.count / humanCommitTotal) ** 2,
      0,
    );
    const activeWeeks = new Set(
      commits
        .filter((commit) => now - commit.date.getTime() <= 84 * 86_400_000)
        .map((commit) => `${commit.date.getUTCFullYear()}-${weekOfYear(commit.date)}`),
    ).size;
    const previousDormantPeriodDays = calculatePreviousDormantPeriodDays(
      commits.map((commit) => commit.date),
      new Date(now),
    );

    const tree = await runGitLines(
      ["--git-dir", repositoryPath, "ls-tree", "-r", "--name-only", "HEAD"],
      30_000,
      90_000,
    );
    const { language: primaryLanguage } = detectPrimaryLanguage(tree.lines);
    const manifests: Record<string, string> = {};
    for (const candidate of manifestCandidates) {
      if (!tree.lines.includes(candidate)) continue;
      try {
        const content = await runGit(["--git-dir", repositoryPath, "show", `HEAD:${candidate}`], {
          timeoutMs: 20_000,
          maxBufferBytes: MAX_MANIFEST_BYTES,
        });
        if (Buffer.byteLength(content, "utf8") <= MAX_MANIFEST_BYTES)
          manifests[candidate] = content;
      } catch {
        /* Optional manifests may be unavailable in partial clones. */
      }
    }
    const technologies = detectTechnologies(tree.lines, manifests);
    const qualitySignals = detectQualitySignals(tree.lines);
    const readmePath = selectReadmePath(tree.lines);
    let readmeAnalysis = null;
    if (readmePath) {
      try {
        const sizeOutput = await runGit(
          ["--git-dir", repositoryPath, "cat-file", "-s", `HEAD:${readmePath}`],
          { timeoutMs: 20_000, maxBufferBytes: 64 * 1024 },
        );
        const sizeBytes = Number.parseInt(sizeOutput.trim(), 10);
        if (Number.isInteger(sizeBytes) && sizeBytes >= 0) {
          let content: string | null = null;
          if (sizeBytes <= README_ANALYSIS_LIMITS.maximumContentBytes) {
            try {
              const candidate = await runGit(
                ["--git-dir", repositoryPath, "show", `HEAD:${readmePath}`],
                {
                  timeoutMs: 20_000,
                  maxBufferBytes: README_ANALYSIS_LIMITS.maximumContentBytes,
                },
              );
              if (
                Buffer.byteLength(candidate, "utf8") <= README_ANALYSIS_LIMITS.maximumContentBytes
              )
                content = candidate;
            } catch {
              /* A partial clone may expose size while the bounded blob remains unavailable. */
            }
          }
          readmeAnalysis = analyzeReadme({ path: readmePath, sizeBytes, content });
        }
      } catch {
        /* README structure is optional evidence and never blocks Git activity inspection. */
      }
    }
    const latestCommitAt = commits[0]?.date ?? null;
    const oldestKnownCommitAt = commits.at(-1)?.date ?? null;
    const tagOutput = await runGit(["--git-dir", repositoryPath, "tag", "--list"], {
      maxBufferBytes: 2 * 1024 * 1024,
    });
    const tagCount = tagOutput.split("\n").filter(Boolean).length;
    const database = await getDatabase();

    await database.transaction(async (transaction) => {
      await transaction.insert(gitAnalyses).values({
        repositoryId: known.id,
        strategy: tree.truncated ? `${strategy}-tree-truncated` : strategy,
        latestCommitAt,
        oldestKnownCommitAt,
        commits30d: commits.filter((commit) => now - commit.date.getTime() <= 30 * 86_400_000)
          .length,
        commits90d: commits90d.length,
        activeWeeks12: activeWeeks,
        previousDormantPeriodDays,
        uniqueAuthors90d: authorCounts.size,
        topContributorShare: topContributorShare === null ? null : String(topContributorShare),
        topThreeContributorShare: String(topThreeContributorShare),
        concentrationIndex: String(concentrationIndex),
        tagCount,
        detectedTechnologies: technologies,
        qualitySignals,
        readmeAnalysis,
        analysisVersion: GIT_ANALYSIS_VERSION,
      });
      await transaction
        .update(repositories)
        .set({
          primaryLanguage: primaryLanguage ?? known.primaryLanguage,
          lastActivityAt: latestCommitAt,
        })
        .where(eq(repositories.id, known.id));
      for (const [contributorKey, author] of sortedAuthors.slice(0, 100)) {
        await transaction
          .insert(repositoryContributors)
          .values({
            repositoryId: known.id,
            contributorKey,
            displayName: author.displayName,
            identityKind: "GIT_AUTHOR",
            isBot: false,
            commits: author.count,
            firstCommitAt: author.first,
            lastCommitAt: author.last,
          })
          .onConflictDoUpdate({
            target: [repositoryContributors.repositoryId, repositoryContributors.contributorKey],
            set: {
              displayName: author.displayName,
              commits: author.count,
              firstCommitAt: author.first,
              lastCommitAt: author.last,
            },
          });
      }
    });
    const touchedAt = new Date();
    await utimes(repositoryPath, touchedAt, touchedAt);

    return {
      repositoryId: known.id,
      fullName: known.fullName,
      strategy,
      primaryLanguage,
      commits90d: commits90d.length,
      previousDormantPeriodDays,
      uniqueAuthors90d: authorCounts.size,
      technologies: technologies.map((technology) => technology.name),
      treeTruncated: tree.truncated,
    };
  }
}

function sanitizeAuthor(author: string): string {
  return (
    author
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Unknown Git author"
  );
}
function isBotAuthor(author: string): boolean {
  return /(?:\[bot\]|dependabot|renovate|github-actions|greenkeeper)/i.test(author);
}
function weekOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - start) / 86_400_000 + new Date(start).getUTCDay() + 1) / 7);
}
async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
