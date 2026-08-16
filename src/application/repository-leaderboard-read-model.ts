import {
  and,
  asc,
  desc,
  eq,
  gte,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";

import {
  calculateRepositoryLeaderboardGrowth,
  REPOSITORY_PERIOD_DAYS,
  repositoryAgeRange,
  repositoryStarRange,
  repositoryStatusMaturities,
  type RepositoryLeaderboardRequest,
} from "@/domain/repository-leaderboard";
import { getDatabase } from "@/infrastructure/db/client";
import { gitAnalyses, repositories, repositorySnapshots } from "@/infrastructure/db/schema";
import { countRepositories, toListItem } from "@/infrastructure/db/repository-store";

const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1_000;

export type RepositoryLeaderboardEntry = {
  repository: ReturnType<typeof toListItem>;
  growth: ReturnType<typeof calculateRepositoryLeaderboardGrowth>;
  ageDays: number | null;
  commits90d: number | null;
  uniqueAuthors90d: number | null;
  gitAnalyzedAt: Date | null;
};

export async function getRepositoryLeaderboardReadModel(
  request: RepositoryLeaderboardRequest,
  asOf = new Date(),
) {
  const database = await getDatabase();
  const periodDays = REPOSITORY_PERIOD_DAYS[request.period];
  const cutoff = periodDays === null ? null : new Date(asOf.getTime() - periodDays * DAY_MS);
  const earliestBaseline =
    periodDays === null ? null : new Date(asOf.getTime() - periodDays * 2 * DAY_MS);
  const conditions = repositoryConditions(request, asOf);
  const baselineConditions: SQL[] = [
    eq(repositorySnapshots.repositoryId, repositories.id),
    isNotNull(repositorySnapshots.stars),
    lte(repositorySnapshots.observedAt, asOf),
  ];
  if (cutoff) baselineConditions.push(lte(repositorySnapshots.observedAt, cutoff));
  if (earliestBaseline)
    baselineConditions.push(gte(repositorySnapshots.observedAt, earliestBaseline));

  const baseline = database
    .select({
      stars: repositorySnapshots.stars,
      observedAt: repositorySnapshots.observedAt,
    })
    .from(repositorySnapshots)
    .where(and(...baselineConditions))
    .orderBy(
      periodDays === null
        ? asc(repositorySnapshots.observedAt)
        : desc(repositorySnapshots.observedAt),
    )
    .limit(1)
    .as("leaderboard_growth_baseline");
  const latestAnalysis = database
    .select({
      repositoryId: gitAnalyses.repositoryId,
      commits90d: gitAnalyses.commits90d,
      uniqueAuthors90d: gitAnalyses.uniqueAuthors90d,
      analyzedAt: gitAnalyses.analyzedAt,
    })
    .from(gitAnalyses)
    .where(eq(gitAnalyses.repositoryId, repositories.id))
    .orderBy(desc(gitAnalyses.analyzedAt))
    .limit(1)
    .as("leaderboard_latest_git_analysis");
  const growth = sql<number | null>`case
    when ${baseline.stars} is not null
      and ${repositories.currentStars} is not null
      and ${repositories.lastSuccessfulFetchAt} is not null
      and ${repositories.lastSuccessfulFetchAt} > ${baseline.observedAt}
      ${cutoff ? sql`and ${gte(repositories.lastSuccessfulFetchAt, cutoff)}` : sql``}
      and ${repositories.currentStars} >= ${baseline.stars}
    then ${repositories.currentStars} - ${baseline.stars}
    else null
  end`;

  const [coverageRows, languages, indexCoverage] = await Promise.all([
    database
      .select({
        filtered: sql<number>`count(*)::int`,
        scored: sql<number>`count(${repositories.currentScore})::int`,
        growthAvailable: sql<number>`count(${growth})::int`,
        gitAnalyzed: sql<number>`count(${latestAnalysis.repositoryId})::int`,
      })
      .from(repositories)
      .leftJoinLateral(baseline, sql`true`)
      .leftJoinLateral(latestAnalysis, sql`true`)
      .where(and(...conditions)),
    database
      .selectDistinct({ language: repositories.primaryLanguage })
      .from(repositories)
      .where(
        and(isNotNull(repositories.lastSuccessfulFetchAt), isNotNull(repositories.primaryLanguage)),
      )
      .orderBy(asc(repositories.primaryLanguage)),
    countRepositories(),
  ]);
  const coverage = coverageRows[0] ?? {
    filtered: 0,
    scored: 0,
    growthAvailable: 0,
    gitAnalyzed: 0,
  };
  const pageCount = Math.max(1, Math.ceil(coverage.filtered / PAGE_SIZE));
  const currentPage = Math.min(request.page, pageCount);
  const rows = await database
    .select({
      repository: repositories,
      baselineStars: baseline.stars,
      baselineObservedAt: baseline.observedAt,
      commits90d: latestAnalysis.commits90d,
      uniqueAuthors90d: latestAnalysis.uniqueAuthors90d,
      gitAnalyzedAt: latestAnalysis.analyzedAt,
    })
    .from(repositories)
    .leftJoinLateral(baseline, sql`true`)
    .leftJoinLateral(latestAnalysis, sql`true`)
    .where(and(...conditions))
    .orderBy(...repositoryOrder(request.sort, growth, latestAnalysis.commits90d))
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

  const repositoryIds = rows.map((row) => row.repository.id);
  const snapshotConditions: SQL[] = [
    inArray(repositorySnapshots.repositoryId, repositoryIds),
    isNotNull(repositorySnapshots.stars),
    lte(repositorySnapshots.observedAt, asOf),
  ];
  if (earliestBaseline)
    snapshotConditions.push(gte(repositorySnapshots.observedAt, earliestBaseline));
  const snapshots =
    repositoryIds.length === 0
      ? []
      : await database
          .select({
            repositoryId: repositorySnapshots.repositoryId,
            observedAt: repositorySnapshots.observedAt,
            stars: repositorySnapshots.stars,
          })
          .from(repositorySnapshots)
          .where(and(...snapshotConditions))
          .orderBy(asc(repositorySnapshots.observedAt));
  const snapshotsByRepository = new Map<
    string,
    Array<{ observedAt: Date; stars: number | null }>
  >();
  for (const snapshot of snapshots) {
    const values = snapshotsByRepository.get(snapshot.repositoryId) ?? [];
    values.push(snapshot);
    snapshotsByRepository.set(snapshot.repositoryId, values);
  }

  const entries: RepositoryLeaderboardEntry[] = rows.map((row) => ({
    repository: toListItem(row.repository),
    growth: calculateRepositoryLeaderboardGrowth(
      snapshotsByRepository.get(row.repository.id) ?? [],
      request.period,
      asOf,
    ),
    ageDays: row.repository.repositoryCreatedAt
      ? Math.max(
          0,
          Math.floor((asOf.getTime() - row.repository.repositoryCreatedAt.getTime()) / DAY_MS),
        )
      : null,
    commits90d: row.commits90d,
    uniqueAuthors90d: row.uniqueAuthors90d,
    gitAnalyzedAt: row.gitAnalyzedAt,
  }));

  return {
    entries,
    options: {
      languages: languages
        .map((row) => row.language)
        .filter((language): language is string => language !== null),
    },
    coverage: {
      identifiers: indexCoverage.total,
      indexed: indexCoverage.indexed,
      filtered: coverage.filtered,
      scored: coverage.scored,
      growthAvailable: coverage.growthAvailable,
      gitAnalyzed: coverage.gitAnalyzed,
      generatedAt: asOf,
    },
    pagination: {
      page: currentPage,
      pageCount,
      pageSize: PAGE_SIZE,
      firstResult: coverage.filtered === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1,
      lastResult: Math.min(currentPage * PAGE_SIZE, coverage.filtered),
    },
  };
}

function repositoryConditions(request: RepositoryLeaderboardRequest, asOf: Date): SQL[] {
  const conditions: SQL[] = [isNotNull(repositories.lastSuccessfulFetchAt)];
  if (!request.includeForks)
    conditions.push(or(eq(repositories.isFork, false), isNull(repositories.isFork))!);
  if (request.language) conditions.push(eq(repositories.primaryLanguage, request.language));
  if (request.query) {
    const term = `%${request.query}%`;
    conditions.push(
      or(
        ilike(repositories.fullName, term),
        ilike(repositories.description, term),
        ilike(repositories.owner, term),
      )!,
    );
  }

  const starRange = repositoryStarRange(request.stars);
  if (starRange.minimum !== undefined)
    conditions.push(gte(repositories.currentStars, starRange.minimum));
  if (starRange.maximumExclusive !== undefined)
    conditions.push(lt(repositories.currentStars, starRange.maximumExclusive));

  const ageRange = repositoryAgeRange(request.age);
  if (request.age !== "all") conditions.push(isNotNull(repositories.repositoryCreatedAt));
  if (ageRange.minimumDays !== undefined)
    conditions.push(
      lte(
        repositories.repositoryCreatedAt,
        new Date(asOf.getTime() - ageRange.minimumDays * DAY_MS),
      ),
    );
  if (ageRange.maximumDaysExclusive !== undefined)
    conditions.push(
      gt(
        repositories.repositoryCreatedAt,
        new Date(asOf.getTime() - ageRange.maximumDaysExclusive * DAY_MS),
      ),
    );

  const maturities = repositoryStatusMaturities(request.status);
  if (maturities) conditions.push(inArray(repositories.maturity, maturities));
  if (request.status === "active") conditions.push(eq(repositories.state, "ACTIVE"));
  if (request.sort === "new-rising") {
    conditions.push(isNotNull(repositories.currentMomentumScore));
    conditions.push(isNotNull(repositories.repositoryCreatedAt));
    conditions.push(gte(repositories.repositoryCreatedAt, new Date(asOf.getTime() - 365 * DAY_MS)));
  }
  return conditions;
}

function repositoryOrder(
  sort: RepositoryLeaderboardRequest["sort"],
  growth: SQL<number | null>,
  commits90d: SQLWrapper,
): SQL[] {
  const primary = {
    score: repositories.currentScore,
    stars: repositories.currentStars,
    growth,
    forks: repositories.currentForks,
    activity: commits90d,
    community: repositories.currentCommunityScore,
    momentum: repositories.currentMomentumScore,
    health: repositories.currentHealthScore,
    "new-rising": repositories.currentMomentumScore,
    recent: repositories.discoveredAt,
  }[sort];
  const order = [sql`${primary} desc nulls last`];
  if (sort === "new-rising") order.push(sql`${repositories.repositoryCreatedAt} desc nulls last`);
  order.push(sql`${repositories.currentScore} desc nulls last`, asc(repositories.fullName));
  return order;
}
