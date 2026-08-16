import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

import type {
  Maturity,
  RepositoryListItem,
  RepositorySnapshotInput,
  RepositoryState,
} from "@/domain/repository";
import { REFRESH_INTERVAL_MS, type RefreshTier } from "@/domain/refresh-policy";

import { getDatabase } from "./client";
import {
  collectionRepositories,
  crawlJobs,
  repositories,
  repositoryAliases,
  repositorySnapshots,
} from "./schema";

const asNumber = (value: string | number | null): number | null =>
  value === null ? null : Number(value);

export function toListItem(row: typeof repositories.$inferSelect): RepositoryListItem {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    fullName: row.fullName,
    description: row.description,
    primaryLanguage: row.primaryLanguage,
    license: row.license,
    defaultBranch: row.defaultBranch,
    isFork: row.isFork,
    stars: row.currentStars,
    forks: row.currentForks,
    score: asNumber(row.currentScore),
    health: asNumber(row.currentHealthScore),
    community: asNumber(row.currentCommunityScore),
    engineering: asNumber(row.currentEngineeringScore),
    scoreConfidence: row.scoreConfidence as RepositoryListItem["scoreConfidence"],
    momentum: asNumber(row.currentMomentumScore),
    sevenDayGrowth: null,
    discoveredAt: row.discoveredAt,
    observedAt: row.lastSuccessfulFetchAt,
    repositoryCreatedAt: row.repositoryCreatedAt,
    lastActivityAt: row.lastActivityAt,
    maturity: row.maturity as Maturity | null,
    rank: row.rank,
    previousRank: row.previousRank,
    state: row.state as RepositoryState,
    refreshTier: row.refreshTier as RepositoryListItem["refreshTier"],
    nextRefreshAt: row.nextRefreshAt,
  };
}

export async function discoverRepository(input: {
  owner: string;
  name: string;
  sourceUrl: string;
}): Promise<typeof repositories.$inferSelect> {
  const database = await getDatabase();
  const fullName = `${input.owner}/${input.name}`;
  const canonicalKey = `github.com/${fullName}`.toLowerCase();
  const [repository] = await database
    .insert(repositories)
    .values({
      owner: input.owner,
      name: input.name,
      fullName,
      canonicalKey,
      sourceUrl: input.sourceUrl,
    })
    .onConflictDoUpdate({
      target: repositories.canonicalKey,
      set: { sourceUrl: input.sourceUrl },
    })
    .returning();

  if (!repository) throw new Error(`Failed to discover ${fullName}`);
  return repository;
}

export async function persistRepositorySnapshot(input: RepositorySnapshotInput): Promise<string> {
  const database = await getDatabase();

  return database.transaction(async (transaction) => {
    const canonicalKey = `github.com/${input.fullName}`.toLowerCase();
    const [repository] = await transaction
      .insert(repositories)
      .values({
        owner: input.owner,
        name: input.name,
        fullName: input.fullName,
        canonicalKey,
        description: input.description,
        homepage: input.homepage,
        defaultBranch: input.defaultBranch,
        primaryLanguage: input.primaryLanguage,
        license: input.license,
        isFork: input.isFork,
        isArchived: input.isArchived,
        state: input.isArchived ? "ARCHIVED" : "ACTIVE",
        sourceUrl: input.sourceUrl,
        parserVersion: input.parserVersion,
        sourceVersion: "github-public-html-v1",
        metadataConfidence: input.confidence,
        currentStars: input.stars,
        currentForks: input.forks,
        lastIndexedAt: input.observedAt,
        lastSuccessfulFetchAt: input.observedAt,
      })
      .onConflictDoUpdate({
        target: repositories.canonicalKey,
        set: {
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          description: sql`coalesce(excluded.description, ${repositories.description})`,
          homepage: sql`coalesce(excluded.homepage, ${repositories.homepage})`,
          defaultBranch: sql`coalesce(excluded.default_branch, ${repositories.defaultBranch})`,
          primaryLanguage: sql`coalesce(excluded.primary_language, ${repositories.primaryLanguage})`,
          license: sql`coalesce(excluded.license, ${repositories.license})`,
          isFork: sql`coalesce(excluded.is_fork, ${repositories.isFork})`,
          isArchived: input.isArchived,
          state: input.isArchived ? "ARCHIVED" : "ACTIVE",
          parserVersion: input.parserVersion,
          sourceVersion: "github-public-html-v1",
          metadataConfidence: input.confidence,
          currentStars: sql`coalesce(excluded.current_stars, ${repositories.currentStars})`,
          currentForks: sql`coalesce(excluded.current_forks, ${repositories.currentForks})`,
          lastIndexedAt: input.observedAt,
          lastSuccessfulFetchAt: input.observedAt,
        },
      })
      .returning({ id: repositories.id, refreshTier: repositories.refreshTier });

    if (!repository) throw new Error(`Failed to persist ${input.fullName}`);

    const refreshTier = repository.refreshTier as RefreshTier;
    await transaction
      .update(repositories)
      .set({
        nextRefreshAt: new Date(input.observedAt.getTime() + REFRESH_INTERVAL_MS[refreshTier]),
      })
      .where(eq(repositories.id, repository.id));

    const provenance = {
      stars: {
        source: "github_public_repository_page",
        observedAt: input.observedAt.toISOString(),
        parserVersion: input.parserVersion,
      },
      forks: {
        source: "github_public_repository_page",
        observedAt: input.observedAt.toISOString(),
        parserVersion: input.parserVersion,
      },
    };

    await transaction
      .insert(repositorySnapshots)
      .values({
        repositoryId: repository.id,
        observedAt: input.observedAt,
        stars: input.stars,
        forks: input.forks,
        confidence: input.confidence,
        parserVersion: input.parserVersion,
        provenance,
      })
      .onConflictDoNothing();

    return repository.id;
  });
}

export async function persistRepositoryAlias(
  previousFullName: string,
  canonicalRepositoryId: string,
): Promise<void> {
  const database = await getDatabase();
  const previousKey = `github.com/${previousFullName}`.toLowerCase();
  await database.transaction(async (transaction) => {
    const [previous] = await transaction
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.canonicalKey, previousKey))
      .limit(1);

    if (previous && previous.id !== canonicalRepositoryId) {
      const memberships = await transaction
        .select()
        .from(collectionRepositories)
        .where(eq(collectionRepositories.repositoryId, previous.id));
      for (const membership of memberships) {
        await transaction
          .insert(collectionRepositories)
          .values({ ...membership, repositoryId: canonicalRepositoryId })
          .onConflictDoNothing();
      }
      await transaction.delete(repositories).where(eq(repositories.id, previous.id));
    }

    await transaction
      .insert(repositoryAliases)
      .values({
        canonicalKey: previousKey,
        repositoryId: canonicalRepositoryId,
        reason: "RENAMED_OR_TRANSFERRED",
      })
      .onConflictDoUpdate({
        target: repositoryAliases.canonicalKey,
        set: { repositoryId: canonicalRepositoryId, observedAt: new Date() },
      });
  });
}

export type RepositoryListOptions = {
  limit?: number;
  offset?: number;
  language?: string;
  sort?: "score" | "stars" | "momentum" | "recent";
  search?: string;
  onlyIndexed?: boolean;
};

export async function listRepositories(
  options: RepositoryListOptions = {},
): Promise<RepositoryListItem[]> {
  const database = await getDatabase();
  const conditions = [];
  if (options.language) conditions.push(eq(repositories.primaryLanguage, options.language));
  if (options.onlyIndexed ?? true) conditions.push(isNotNull(repositories.lastSuccessfulFetchAt));
  if (options.search) {
    const term = `%${options.search}%`;
    conditions.push(
      or(
        ilike(repositories.fullName, term),
        ilike(repositories.description, term),
        ilike(repositories.owner, term),
      ),
    );
  }

  const orderBy = {
    score: desc(repositories.currentScore),
    stars: desc(repositories.currentStars),
    momentum: desc(repositories.currentMomentumScore),
    recent: desc(repositories.discoveredAt),
  }[options.sort ?? "score"];

  const rows = await database
    .select()
    .from(repositories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${orderBy} nulls last`, asc(repositories.fullName))
    .limit(Math.min(options.limit ?? 24, 100))
    .offset(options.offset ?? 0);

  const items = rows.map(toListItem);
  const repositoryIds = rows.map((row) => row.id);
  if (repositoryIds.length === 0) return items;

  const snapshots = await database
    .select({
      repositoryId: repositorySnapshots.repositoryId,
      observedAt: repositorySnapshots.observedAt,
      stars: repositorySnapshots.stars,
    })
    .from(repositorySnapshots)
    .where(
      and(
        inArray(repositorySnapshots.repositoryId, repositoryIds),
        gte(repositorySnapshots.observedAt, new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000)),
      ),
    )
    .orderBy(asc(repositorySnapshots.observedAt));

  const growthByRepository = new Map<string, number>();
  for (const repositoryId of repositoryIds) {
    const observed = snapshots.filter(
      (snapshot) => snapshot.repositoryId === repositoryId && snapshot.stars !== null,
    );
    const first = observed.at(0)?.stars;
    const last = observed.at(-1)?.stars;
    if (
      first !== null &&
      first !== undefined &&
      last !== null &&
      last !== undefined &&
      observed.length >= 2
    ) {
      growthByRepository.set(repositoryId, Math.max(0, last - first));
    }
  }

  return items.map((item) => ({
    ...item,
    sevenDayGrowth: growthByRepository.get(item.id) ?? null,
  }));
}

export async function getRepository(
  owner: string,
  name: string,
): Promise<RepositoryListItem | null> {
  const database = await getDatabase();
  const canonicalKey = `github.com/${owner}/${name}`.toLowerCase();
  const [row] = await database
    .select()
    .from(repositories)
    .where(eq(repositories.canonicalKey, canonicalKey))
    .limit(1);
  const [aliased] = await database
    .select({ repository: repositories })
    .from(repositoryAliases)
    .innerJoin(repositories, eq(repositories.id, repositoryAliases.repositoryId))
    .where(eq(repositoryAliases.canonicalKey, canonicalKey))
    .limit(1);
  if (aliased && (!row || row.lastSuccessfulFetchAt === null))
    return toListItem(aliased.repository);
  return row ? toListItem(row) : null;
}

export async function countRepositories(): Promise<{ total: number; indexed: number }> {
  const database = await getDatabase();
  const [row] = await database
    .select({
      total: sql<number>`count(*)::int`,
      indexed: sql<number>`count(${repositories.lastSuccessfulFetchAt})::int`,
    })
    .from(repositories);
  return row ?? { total: 0, indexed: 0 };
}

export async function getRepositorySnapshots(repositoryId: string) {
  const database = await getDatabase();
  return database
    .select()
    .from(repositorySnapshots)
    .where(eq(repositorySnapshots.repositoryId, repositoryId))
    .orderBy(asc(repositorySnapshots.observedAt))
    .limit(10_000);
}

export async function enqueueRepositoryIndex(
  repositoryId: string,
  fullName: string,
  priority = 50,
): Promise<boolean> {
  const database = await getDatabase();
  const inserted = await database
    .insert(crawlJobs)
    .values({
      type: "refresh_repository_metadata",
      deduplicationKey: `refresh_repository_metadata:${fullName.toLowerCase()}`,
      priority,
      payload: { repositoryId, fullName },
    })
    .onConflictDoNothing()
    .returning({ id: crawlJobs.id });
  return inserted.length > 0;
}

export async function recordRepositoryPageView(
  owner: string,
  name: string,
  now = new Date(),
): Promise<boolean> {
  const database = await getDatabase();
  const canonicalKey = `github.com/${owner}/${name}`.toLowerCase();
  const updated = await database
    .update(repositories)
    .set({ pageViewCount: sql`${repositories.pageViewCount} + 1`, lastViewedAt: now })
    .where(eq(repositories.canonicalKey, canonicalKey))
    .returning({ id: repositories.id });
  return updated.length > 0;
}
