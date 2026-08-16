import { lstat, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const ACTIVE_GRACE_MS = 10 * 60 * 1_000;

type CacheEntry = { path: string; bytes: number; modifiedAt: number };

export type GitCacheReport = {
  beforeBytes: number;
  afterBytes: number;
  removed: string[];
  overLimit: boolean;
};

export function gitCacheLimitBytes(): number {
  const gigabytes = Number(process.env.GIT_CACHE_MAX_GB ?? 10);
  if (!Number.isFinite(gigabytes) || gigabytes <= 0)
    throw new Error("GIT_CACHE_MAX_GB must be a positive number.");
  return Math.floor(gigabytes * 1024 ** 3);
}

export async function inspectGitCache(
  cacheRoot: string,
): Promise<{ bytes: number; repositories: number }> {
  const entries = await listRepositoryCaches(cacheRoot);
  return {
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    repositories: entries.length,
  };
}

export async function enforceGitCacheQuota(
  cacheRoot: string,
  maximumBytes = gitCacheLimitBytes(),
  protectedPaths: string[] = [],
): Promise<GitCacheReport> {
  if (!Number.isFinite(maximumBytes) || maximumBytes <= 0)
    throw new Error("Git cache quota must be a positive byte count.");
  const root = path.resolve(cacheRoot);
  const protectedSet = new Set(
    protectedPaths.map((candidate) => assertCacheRepositoryPath(root, candidate)),
  );
  const entries = await listRepositoryCaches(root);
  const beforeBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  let afterBytes = beforeBytes;
  const removed: string[] = [];
  const staleBefore = Date.now() - ACTIVE_GRACE_MS;
  for (const entry of entries.sort((left, right) => left.modifiedAt - right.modifiedAt)) {
    if (afterBytes <= maximumBytes) break;
    if (protectedSet.has(entry.path) || entry.modifiedAt >= staleBefore) continue;
    await rm(entry.path, { recursive: true, force: true });
    afterBytes -= entry.bytes;
    removed.push(path.relative(root, entry.path));
  }
  return { beforeBytes, afterBytes, removed, overLimit: afterBytes > maximumBytes };
}

export async function removeGitCacheRepository(
  cacheRoot: string,
  repositoryPath: string,
): Promise<void> {
  const root = path.resolve(cacheRoot);
  const target = assertCacheRepositoryPath(root, repositoryPath);
  await rm(target, { recursive: true, force: true });
}

function assertCacheRepositoryPath(cacheRoot: string, candidate: string): string {
  const target = path.resolve(candidate);
  const relative = path.relative(cacheRoot, target);
  const segments = relative.split(path.sep);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    segments.length !== 3 ||
    segments[0] !== "github.com" ||
    !segments[2]?.endsWith(".git")
  ) {
    throw new Error(
      "Refusing to operate on a path outside the validated Git cache repository layout.",
    );
  }
  return target;
}

async function listRepositoryCaches(cacheRoot: string): Promise<CacheEntry[]> {
  const hostRoot = path.join(path.resolve(cacheRoot), "github.com");
  const entries: CacheEntry[] = [];
  for (const owner of await safeDirectories(hostRoot)) {
    const ownerPath = path.join(hostRoot, owner);
    for (const repository of await safeDirectories(ownerPath)) {
      if (!repository.endsWith(".git")) continue;
      const repositoryPath = path.join(ownerPath, repository);
      const repositoryStat = await stat(repositoryPath);
      entries.push({
        path: repositoryPath,
        bytes: await directoryBytes(repositoryPath),
        modifiedAt: repositoryStat.mtimeMs,
      });
    }
  }
  return entries;
}

async function safeDirectories(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    const metadata = await lstat(target);
    if (entry.isDirectory() && !entry.isSymbolicLink()) total += await directoryBytes(target);
    else total += metadata.size;
  }
  return total;
}
