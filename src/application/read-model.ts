import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";

import { analyzeDeveloperPortfolio } from "@/domain/developer-intelligence";
import { applyDeveloperProfileEvents } from "@/domain/developer-profile";
import type { Confidence } from "@/domain/confidence";
import { calculateRepositorySimilarity } from "@/domain/similarity";
import { deriveRepositoryEvents } from "@/domain/repository-events";
import { technologySlug } from "@/domain/technology/slug";
import { formatObservationAge } from "@/domain/format";
import { getHomeDiscoveryReadModel } from "@/application/discovery-read-model";
import { trigramSimilarity } from "@/domain/search";
import {
  countRepositories,
  getRepositorySnapshots,
  listRepositories,
} from "@/infrastructure/db/repository-store";
import { toListItem } from "@/infrastructure/db/repository-store";
import {
  applyDeveloperDisplayNameCorrections,
  getDeveloperSnapshots,
  listDevelopers,
} from "@/infrastructure/db/developer-store";
import { getDatabase } from "@/infrastructure/db/client";
import {
  collectionRepositories,
  collections,
  developerProfileEvents,
  developers,
  ecosystemSnapshots,
  gitAnalyses,
  rankingSnapshots,
  repositories,
  repositorySnapshots,
  repositoryContributors,
  repositoryTopics,
  systemState,
  topics,
} from "@/infrastructure/db/schema";

export type DataAvailability = "READY" | "EMPTY" | "UNINITIALIZED";

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getHomeReadModel() {
  try {
    const [coverage, discovery, leaders, recentlyDiscovered] = await Promise.all([
      countRepositories(),
      getHomeDiscoveryReadModel(),
      listRepositories({ sort: "score", limit: 6 }),
      listRepositories({ sort: "recent", limit: 8, onlyIndexed: false }),
    ]);
    return {
      availability: coverage.total === 0 ? ("EMPTY" as const) : ("READY" as const),
      coverage,
      trending: discovery.trending.map((ranking) => ranking.repository),
      leaders,
      hiddenGems: discovery.gems.map((ranking) => ranking.repository),
      recentlyDiscovered,
    };
  } catch {
    return {
      availability: "UNINITIALIZED" as const,
      coverage: { total: 0, indexed: 0 },
      trending: [],
      leaders: [],
      hiddenGems: [],
      recentlyDiscovered: [],
    };
  }
}

export async function getRepositoryDetailReadModel(owner: string, name: string) {
  const { getRepository } = await import("@/infrastructure/db/repository-store");
  try {
    const repository = await getRepository(owner, name);
    if (!repository) return null;
    const database = await getDatabase();
    const [
      snapshots,
      analyses,
      contributors,
      topicClassifications,
      similarRepositories,
      rankHistoryRows,
      rankingCoverage,
    ] = await Promise.all([
      getRepositorySnapshots(repository.id),
      database
        .select()
        .from(gitAnalyses)
        .where(eq(gitAnalyses.repositoryId, repository.id))
        .orderBy(desc(gitAnalyses.analyzedAt))
        .limit(100),
      database
        .select()
        .from(repositoryContributors)
        .where(eq(repositoryContributors.repositoryId, repository.id))
        .orderBy(desc(repositoryContributors.commits))
        .limit(20),
      database
        .select({
          slug: topics.slug,
          name: topics.name,
          confidence: repositoryTopics.confidence,
          evidence: repositoryTopics.evidence,
        })
        .from(repositoryTopics)
        .innerJoin(topics, eq(topics.slug, repositoryTopics.topicSlug))
        .where(eq(repositoryTopics.repositoryId, repository.id))
        .orderBy(asc(topics.name)),
      getSimilarRepositories(repository.id),
      database
        .select({
          calculatedAt: rankingSnapshots.calculatedAt,
          rank: rankingSnapshots.rank,
          score: rankingSnapshots.score,
          rankingVersion: rankingSnapshots.rankingVersion,
        })
        .from(rankingSnapshots)
        .where(
          and(
            eq(rankingSnapshots.repositoryId, repository.id),
            eq(rankingSnapshots.scope, "global"),
            eq(rankingSnapshots.period, "all"),
          ),
        )
        .orderBy(asc(rankingSnapshots.calculatedAt))
        .limit(1_000),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(repositories)
        .where(isNotNull(repositories.currentScore)),
    ]);
    const rankHistory = rankHistoryRows.map((point) => ({
      ...point,
      score: Number(point.score),
    }));
    const repositoryEvents = deriveRepositoryEvents({
      snapshots: snapshots.map((snapshot) => ({
        observedAt: snapshot.observedAt,
        stars: snapshot.stars,
        momentumScore: snapshot.momentumScore === null ? null : Number(snapshot.momentumScore),
        scoreVersion: snapshot.scoreVersion,
        anomalyFlags: snapshot.anomalyFlags,
        confidence: snapshot.confidence as Confidence,
      })),
      ranks: rankHistory.map((point) => ({
        calculatedAt: point.calculatedAt,
        rank: point.rank,
        rankingVersion: point.rankingVersion,
      })),
      gitAnalyses: [...analyses].reverse().map((analysis) => ({
        analyzedAt: analysis.analyzedAt,
        latestCommitAt: analysis.latestCommitAt,
        activeWeeks12: analysis.activeWeeks12,
        previousDormantPeriodDays: analysis.previousDormantPeriodDays,
        tagCount: analysis.tagCount,
      })),
    }).slice(0, 50);
    return {
      repository,
      freshnessLabel: formatObservationAge(repository.observedAt),
      snapshots,
      gitAnalysis: analyses[0] ?? null,
      contributors,
      topicClassifications,
      similarRepositories,
      rankHistory,
      repositoryEvents,
      rankingCohortSize: rankingCoverage[0]?.count ?? 0,
    };
  } catch {
    return null;
  }
}

async function getSimilarRepositories(repositoryId: string) {
  const database = await getDatabase();
  const [target] = await database
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);
  if (!target) return [];
  const [candidates, topicRows, analyses] = await Promise.all([
    database
      .select()
      .from(repositories)
      .where(and(ne(repositories.id, repositoryId), isNotNull(repositories.lastSuccessfulFetchAt)))
      .limit(250),
    database.select().from(repositoryTopics),
    database.select().from(gitAnalyses).orderBy(desc(gitAnalyses.analyzedAt)),
  ]);
  const topicsByRepository = new Map<string, string[]>();
  for (const row of topicRows)
    topicsByRepository.set(row.repositoryId, [
      ...(topicsByRepository.get(row.repositoryId) ?? []),
      row.topicSlug,
    ]);
  const technologiesByRepository = new Map<string, string[]>();
  for (const analysis of analyses) {
    if (!technologiesByRepository.has(analysis.repositoryId))
      technologiesByRepository.set(
        analysis.repositoryId,
        (analysis.detectedTechnologies ?? []).map((technology) => technology.name),
      );
  }
  const targetTopics = topicsByRepository.get(repositoryId) ?? [];
  const targetTechnologies = technologiesByRepository.get(repositoryId) ?? [];
  return candidates
    .map((candidate) => {
      const similarity = calculateRepositorySimilarity({
        language: target.primaryLanguage,
        candidateLanguage: candidate.primaryLanguage,
        topics: targetTopics,
        candidateTopics: topicsByRepository.get(candidate.id) ?? [],
        technologies: targetTechnologies,
        candidateTechnologies: technologiesByRepository.get(candidate.id) ?? [],
        maturity: target.maturity,
        candidateMaturity: candidate.maturity,
      });
      return {
        ...toListItem(candidate),
        similarity: similarity.score,
        similarityEvidence: similarity.evidence,
      };
    })
    .filter((candidate) => candidate.similarity >= 15)
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        (right.score ?? -1) - (left.score ?? -1) ||
        left.fullName.localeCompare(right.fullName),
    )
    .slice(0, 6);
}

export async function getLanguageReadModels() {
  try {
    const database = await getDatabase();
    return await database
      .select({
        name: repositories.primaryLanguage,
        repositoryCount: sql<number>`count(*)::int`,
        totalStars: sql<number>`coalesce(sum(${repositories.currentStars}), 0)::int`,
        averageScore: sql<number>`round(avg(${repositories.currentScore})::numeric, 1)`,
        averageMomentum: sql<number>`round(avg(${repositories.currentMomentumScore})::numeric, 2)`,
      })
      .from(repositories)
      .where(isNotNull(repositories.primaryLanguage))
      .groupBy(repositories.primaryLanguage)
      .orderBy(desc(sql`count(*)`));
  } catch {
    return [];
  }
}

export async function getLanguageEcosystemHistory(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return [];
  try {
    const database = await getDatabase();
    const rows = await database
      .select()
      .from(ecosystemSnapshots)
      .where(
        and(
          eq(ecosystemSnapshots.ecosystemType, "LANGUAGE"),
          eq(ecosystemSnapshots.ecosystemKey, slug),
        ),
      )
      .orderBy(desc(ecosystemSnapshots.observedAt))
      .limit(1_000);
    return rows.reverse();
  } catch {
    return [];
  }
}

export async function getCollectionsReadModel() {
  try {
    const database = await getDatabase();
    return await database
      .select({
        slug: collections.slug,
        name: collections.name,
        description: collections.description,
        repositoryCount: sql<number>`count(${collectionRepositories.repositoryId})::int`,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .leftJoin(collectionRepositories, eq(collectionRepositories.collectionSlug, collections.slug))
      .groupBy(collections.slug)
      .orderBy(asc(collections.name));
  } catch {
    return [];
  }
}

export async function getCollectionReadModel(slug: string) {
  try {
    const database = await getDatabase();
    const [collection] = await database
      .select()
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1);
    if (!collection) return null;
    const rows = await database
      .select({ repository: repositories })
      .from(collectionRepositories)
      .innerJoin(repositories, eq(repositories.id, collectionRepositories.repositoryId))
      .where(eq(collectionRepositories.collectionSlug, slug))
      .orderBy(asc(collectionRepositories.position));
    return { collection, repositories: rows.map((row) => toListItem(row.repository)) };
  } catch {
    return null;
  }
}

export async function searchIndex(query: string) {
  const cleaned = query.trim().slice(0, 100);
  try {
    const database = await getDatabase();
    if (cleaned.length < 2) {
      const [repositoryRows, developerRows, languageRows, collectionRows, topicRows] =
        await Promise.all([
          database
            .select({
              owner: repositories.owner,
              name: repositories.name,
              fullName: repositories.fullName,
              description: repositories.description,
              score: repositories.currentScore,
            })
            .from(repositories)
            .where(isNotNull(repositories.lastSuccessfulFetchAt))
            .orderBy(desc(repositories.currentScore), desc(repositories.currentStars))
            .limit(4),
          database
            .select({
              id: developers.id,
              username: developers.username,
              displayName: developers.displayName,
              score: developers.currentScore,
            })
            .from(developers)
            .where(and(isNotNull(developers.lastIndexedAt), eq(developers.visibility, "PUBLIC")))
            .orderBy(desc(developers.currentScore))
            .limit(3),
          database
            .select({
              slug: sql<string>`lower(regexp_replace(${repositories.primaryLanguage}, '[^a-zA-Z0-9]+', '-', 'g'))`,
              name: repositories.primaryLanguage,
              count: sql<number>`count(*)::int`,
            })
            .from(repositories)
            .where(isNotNull(repositories.primaryLanguage))
            .groupBy(repositories.primaryLanguage)
            .orderBy(desc(sql`count(*)`))
            .limit(4),
          database
            .select({
              slug: collections.slug,
              name: collections.name,
              description: collections.description,
            })
            .from(collections)
            .orderBy(desc(collections.updatedAt))
            .limit(3),
          database
            .select({
              slug: topics.slug,
              name: topics.name,
              description: topics.description,
              count: sql<number>`count(${repositoryTopics.repositoryId})::int`,
            })
            .from(topics)
            .leftJoin(repositoryTopics, eq(repositoryTopics.topicSlug, topics.slug))
            .groupBy(topics.slug)
            .orderBy(desc(sql`count(${repositoryTopics.repositoryId})`), asc(topics.name))
            .limit(4),
        ]);
      const technologyRows = (await getTechnologiesReadModel())
        .slice(0, 4)
        .map(({ slug, name, category, repositoryCount }) => ({
          slug,
          name,
          category,
          repositoryCount,
        }));
      const correctedDevelopers = await applyDeveloperDisplayNameCorrections(developerRows);
      return {
        repositories: repositoryRows,
        developers: correctedDevelopers.map((developer) => ({
          username: developer.username,
          displayName: developer.displayName,
          score: developer.score,
        })),
        languages: languageRows.filter(
          (language): language is { slug: string; name: string; count: number } =>
            language.name !== null,
        ),
        technologies: technologyRows,
        topics: topicRows,
        collections: collectionRows,
      };
    }
    const term = `%${cleaned}%`;
    const repositoryDocument = sql`to_tsvector('simple', coalesce(${repositories.fullName}, '') || ' ' || coalesce(${repositories.owner}, '') || ' ' || coalesce(${repositories.description}, '') || ' ' || coalesce(${repositories.primaryLanguage}, ''))`;
    const repositoryQuery = sql`websearch_to_tsquery('simple', ${cleaned})`;
    const repositoryRelevance = sql<number>`greatest(ts_rank_cd(${repositoryDocument}, ${repositoryQuery}) * 10, similarity(${repositories.fullName}, ${cleaned}), similarity(${repositories.name}, ${cleaned}), similarity(${repositories.owner}, ${cleaned})) + case when lower(${repositories.fullName}) = lower(${cleaned}) then 4 when lower(${repositories.name}) = lower(${cleaned}) then 2 else 0 end`;
    const developerDocument = sql`to_tsvector('simple', coalesce(${developers.username}, '') || ' ' || coalesce(${developers.displayName}, '') || ' ' || coalesce(${developers.bio}, ''))`;
    const developerQuery = sql`websearch_to_tsquery('simple', ${cleaned})`;
    const [repositoryRows, developerRows, languageRows, collectionRows, topicRows] =
      await Promise.all([
        database
          .select({
            owner: repositories.owner,
            name: repositories.name,
            fullName: repositories.fullName,
            description: repositories.description,
            score: repositories.currentScore,
            relevance: repositoryRelevance,
          })
          .from(repositories)
          .where(
            or(
              sql`${repositoryDocument} @@ ${repositoryQuery}`,
              sql`similarity(${repositories.fullName}, ${cleaned}) > 0.16`,
              sql`similarity(${repositories.name}, ${cleaned}) > 0.2`,
              sql`similarity(${repositories.owner}, ${cleaned}) > 0.2`,
              ilike(repositories.primaryLanguage, term),
            ),
          )
          .orderBy(desc(repositoryRelevance), desc(repositories.currentScore))
          .limit(8),
        database
          .select({
            id: developers.id,
            username: developers.username,
            displayName: developers.displayName,
            score: developers.currentScore,
            relevance: sql<number>`greatest(ts_rank_cd(${developerDocument}, ${developerQuery}) * 10, similarity(${developers.username}, ${cleaned}), similarity(coalesce(${developers.displayName}, ''), ${cleaned}))`,
          })
          .from(developers)
          .where(
            and(
              isNotNull(developers.lastIndexedAt),
              eq(developers.visibility, "PUBLIC"),
              or(
                sql`${developerDocument} @@ ${developerQuery}`,
                sql`similarity(${developers.username}, ${cleaned}) > 0.2`,
                ilike(developers.displayName, term),
              ),
            ),
          )
          .orderBy(
            desc(
              sql`greatest(ts_rank_cd(${developerDocument}, ${developerQuery}) * 10, similarity(${developers.username}, ${cleaned}), similarity(coalesce(${developers.displayName}, ''), ${cleaned}))`,
            ),
          )
          .limit(4),
        database
          .select({
            slug: sql<string>`lower(regexp_replace(${repositories.primaryLanguage}, '[^a-zA-Z0-9]+', '-', 'g'))`,
            name: repositories.primaryLanguage,
          })
          .from(repositories)
          .where(
            and(
              isNotNull(repositories.primaryLanguage),
              or(
                ilike(repositories.primaryLanguage, term),
                sql`similarity(${repositories.primaryLanguage}, ${cleaned}) > 0.25`,
              ),
            ),
          )
          .groupBy(repositories.primaryLanguage)
          .orderBy(desc(sql`similarity(${repositories.primaryLanguage}, ${cleaned})`))
          .limit(4),
        database
          .select({
            slug: collections.slug,
            name: collections.name,
            description: collections.description,
          })
          .from(collections)
          .where(
            or(
              sql`to_tsvector('simple', ${collections.name} || ' ' || ${collections.description}) @@ websearch_to_tsquery('simple', ${cleaned})`,
              sql`similarity(${collections.name}, ${cleaned}) > 0.2`,
            ),
          )
          .orderBy(
            desc(
              sql`greatest(ts_rank_cd(to_tsvector('simple', ${collections.name} || ' ' || ${collections.description}), websearch_to_tsquery('simple', ${cleaned})), similarity(${collections.name}, ${cleaned}))`,
            ),
          )
          .limit(4),
        database
          .select({ slug: topics.slug, name: topics.name, description: topics.description })
          .from(topics)
          .where(
            or(
              sql`to_tsvector('simple', ${topics.name} || ' ' || coalesce(${topics.description}, '')) @@ websearch_to_tsquery('simple', ${cleaned})`,
              sql`similarity(${topics.name}, ${cleaned}) > 0.2`,
            ),
          )
          .orderBy(
            desc(
              sql`greatest(ts_rank_cd(to_tsvector('simple', ${topics.name} || ' ' || coalesce(${topics.description}, '')), websearch_to_tsquery('simple', ${cleaned})), similarity(${topics.name}, ${cleaned}))`,
            ),
          )
          .limit(4),
      ]);
    const technologyRows = (await getTechnologiesReadModel())
      .map((technology) => ({
        ...technology,
        relevance: Math.max(
          technology.name.toLowerCase().includes(cleaned.toLowerCase()) ? 1 : 0,
          trigramSimilarity(technology.name, cleaned),
        ),
      }))
      .filter((technology) => technology.relevance >= 0.2)
      .sort(
        (left, right) =>
          right.relevance - left.relevance || right.repositoryCount - left.repositoryCount,
      )
      .slice(0, 4)
      .map(({ slug, name, category, repositoryCount }) => ({
        slug,
        name,
        category,
        repositoryCount,
      }));
    const correctedDevelopers = await applyDeveloperDisplayNameCorrections(developerRows);
    return {
      repositories: repositoryRows,
      developers: correctedDevelopers.map((developer) => ({
        username: developer.username,
        displayName: developer.displayName,
        score: developer.score,
        relevance: developer.relevance,
      })),
      languages: languageRows.filter(
        (language): language is { slug: string; name: string } => language.name !== null,
      ),
      technologies: technologyRows,
      topics: topicRows,
      collections: collectionRows,
    };
  } catch {
    return {
      repositories: [],
      developers: [],
      languages: [],
      technologies: [],
      topics: [],
      collections: [],
    };
  }
}

export async function getTopicsReadModel() {
  try {
    const database = await getDatabase();
    return await database
      .select({
        slug: topics.slug,
        name: topics.name,
        description: topics.description,
        repositoryCount: sql<number>`count(${repositoryTopics.repositoryId})::int`,
      })
      .from(topics)
      .leftJoin(repositoryTopics, eq(repositoryTopics.topicSlug, topics.slug))
      .groupBy(topics.slug)
      .orderBy(desc(sql`count(${repositoryTopics.repositoryId})`), asc(topics.name));
  } catch {
    return [];
  }
}

export async function getTopicReadModel(slug: string) {
  try {
    const database = await getDatabase();
    const [topic] = await database.select().from(topics).where(eq(topics.slug, slug)).limit(1);
    if (!topic) return null;
    const rows = await database
      .select({
        repository: repositories,
        confidence: repositoryTopics.confidence,
        evidence: repositoryTopics.evidence,
      })
      .from(repositoryTopics)
      .innerJoin(repositories, eq(repositories.id, repositoryTopics.repositoryId))
      .where(eq(repositoryTopics.topicSlug, slug))
      .orderBy(desc(repositories.currentScore), asc(repositories.fullName));
    return {
      topic,
      repositories: rows.map((row) => ({
        ...toListItem(row.repository),
        topicConfidence: row.confidence,
        topicEvidence: row.evidence,
      })),
    };
  } catch {
    return null;
  }
}

export async function getCoverageReadModel() {
  try {
    const database = await getDatabase();
    const [
      coverage,
      developerCount,
      languageCount,
      collectionCount,
      scoredCount,
      gitAnalyzedCount,
      snapshotState,
      refreshedCount,
      refreshDueCount,
      rankingState,
    ] = await Promise.all([
      countRepositories(),
      database.select({ count: sql<number>`count(*)::int` }).from(developers),
      database
        .select({ count: sql<number>`count(distinct ${repositories.primaryLanguage})::int` })
        .from(repositories),
      database.select({ count: sql<number>`count(*)::int` }).from(collections),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(repositories)
        .where(isNotNull(repositories.currentScore)),
      database
        .select({ count: sql<number>`count(distinct ${gitAnalyses.repositoryId})::int` })
        .from(gitAnalyses),
      database
        .select({
          count: sql<number>`count(*)::int`,
          first: sql<Date | null>`min(${repositorySnapshots.observedAt})`,
          latest: sql<Date | null>`max(${repositorySnapshots.observedAt})`,
        })
        .from(repositorySnapshots),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(repositories)
        .where(gte(repositories.lastSuccessfulFetchAt, sql`now() - interval '24 hours'`)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(repositories)
        .where(
          and(
            isNotNull(repositories.lastSuccessfulFetchAt),
            isNotNull(repositories.nextRefreshAt),
            lte(repositories.nextRefreshAt, sql`now()`),
          ),
        ),
      database
        .select()
        .from(systemState)
        .where(eq(systemState.key, "last_repository_ranking"))
        .limit(1),
    ]);
    return {
      ...coverage,
      developers: developerCount[0]?.count ?? 0,
      languages: languageCount[0]?.count ?? 0,
      collections: collectionCount[0]?.count ?? 0,
      scored: scoredCount[0]?.count ?? 0,
      gitAnalyzed: gitAnalyzedCount[0]?.count ?? 0,
      snapshots: snapshotState[0]?.count ?? 0,
      historyStartedAt: dateValue(snapshotState[0]?.first),
      latestSnapshotAt: dateValue(snapshotState[0]?.latest),
      refreshed24h: refreshedCount[0]?.count ?? 0,
      refreshDue: refreshDueCount[0]?.count ?? 0,
      lastRanking: rankingState[0]?.updatedAt ?? null,
    };
  } catch {
    return {
      total: 0,
      indexed: 0,
      developers: 0,
      languages: 0,
      collections: 0,
      scored: 0,
      gitAnalyzed: 0,
      snapshots: 0,
      historyStartedAt: null,
      latestSnapshotAt: null,
      refreshed24h: 0,
      refreshDue: 0,
      lastRanking: null,
    };
  }
}

export async function getDevelopersReadModel() {
  try {
    return await listDevelopers(100);
  } catch {
    return [];
  }
}

export async function getDeveloperReadModel(username: string) {
  try {
    const database = await getDatabase();
    const [sourceDeveloper] = await database
      .select()
      .from(developers)
      .where(
        and(
          eq(developers.canonicalUsername, username.toLowerCase()),
          isNotNull(developers.lastIndexedAt),
          eq(developers.visibility, "PUBLIC"),
        ),
      )
      .limit(1);
    if (!sourceDeveloper) return null;
    const [snapshots, ownedRows, profileEvents, confirmedContributions] = await Promise.all([
      getDeveloperSnapshots(sourceDeveloper.id),
      database
        .select()
        .from(repositories)
        .where(
          and(
            eq(sql`lower(${repositories.owner})`, sourceDeveloper.canonicalUsername),
            eq(repositories.isFork, false),
            isNotNull(repositories.lastSuccessfulFetchAt),
          ),
        )
        .orderBy(desc(repositories.currentScore), desc(repositories.currentStars)),
      database
        .select()
        .from(developerProfileEvents)
        .where(eq(developerProfileEvents.developerId, sourceDeveloper.id))
        .orderBy(asc(developerProfileEvents.createdAt)),
      database
        .select({ contributor: repositoryContributors, repository: repositories })
        .from(repositoryContributors)
        .innerJoin(repositories, eq(repositories.id, repositoryContributors.repositoryId))
        .where(eq(repositoryContributors.developerId, sourceDeveloper.id))
        .orderBy(desc(repositoryContributors.commits)),
    ]);
    const repositoryIds = ownedRows.map((repository) => repository.id);
    const analyses =
      repositoryIds.length === 0
        ? []
        : await database
            .selectDistinctOn([gitAnalyses.repositoryId])
            .from(gitAnalyses)
            .where(inArray(gitAnalyses.repositoryId, repositoryIds))
            .orderBy(gitAnalyses.repositoryId, desc(gitAnalyses.analyzedAt));
    const analysisByRepository = new Map(
      analyses.map((analysis) => [analysis.repositoryId, analysis]),
    );
    const repositoriesWithActivity = ownedRows.map((repository) => ({
      repository: toListItem(repository),
      analysis: analysisByRepository.get(repository.id) ?? null,
    }));
    const intelligence = analyzeDeveloperPortfolio(
      repositoriesWithActivity.map(({ repository, analysis }) => ({
        repositoryId: repository.id,
        fullName: repository.fullName,
        primaryLanguage: repository.primaryLanguage,
        stars: repository.stars,
        analyzedAt: analysis?.analyzedAt ?? null,
        latestCommitAt: analysis?.latestCommitAt ?? null,
        commits30d: analysis?.commits30d ?? null,
        commits90d: analysis?.commits90d ?? null,
        activeWeeks12: analysis?.activeWeeks12 ?? null,
        uniqueAuthors90d: analysis?.uniqueAuthors90d ?? null,
        topContributorShare:
          analysis?.topContributorShare === null || analysis?.topContributorShare === undefined
            ? null
            : Number(analysis.topContributorShare),
      })),
    );
    const timeline = [
      ...snapshots.map((snapshot) => ({
        occurredAt: snapshot.observedAt,
        kind: "PROFILE_OBSERVED" as const,
        title: "Public profile observed",
        detail: `${snapshot.confidence.toLowerCase()} confidence · ${snapshot.parserVersion}`,
      })),
      ...repositoriesWithActivity.flatMap(({ repository, analysis }) =>
        analysis
          ? [
              {
                occurredAt: analysis.analyzedAt,
                kind: "PROJECT_ANALYZED" as const,
                title: `${repository.fullName} Git evidence analyzed`,
                detail:
                  analysis.commits90d === null
                    ? "90-day activity unavailable"
                    : `${analysis.commits90d} repository commits in the observed 90-day window`,
              },
            ]
          : [],
      ),
      ...(sourceDeveloper.scoreCalculatedAt
        ? [
            {
              occurredAt: sourceDeveloper.scoreCalculatedAt,
              kind: "SCORE_CALCULATED" as const,
              title: "Developer score calculated",
              detail: `${sourceDeveloper.scoreVersion ?? "version unavailable"} · ${sourceDeveloper.scoreConfidence.toLowerCase()} confidence`,
            },
          ]
        : []),
    ]
      .toSorted((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 12);
    const developer = applyDeveloperProfileEvents(sourceDeveloper, profileEvents);
    return {
      developer,
      snapshots,
      repositories: repositoriesWithActivity.map((entry) => entry.repository),
      repositoriesWithActivity,
      intelligence,
      timeline,
      confirmedContributions,
    };
  } catch {
    return null;
  }
}

export async function getTechnologiesReadModel() {
  try {
    const database = await getDatabase();
    const [repositoryRows, analyses] = await Promise.all([
      database.select().from(repositories).where(isNotNull(repositories.lastSuccessfulFetchAt)),
      database.select().from(gitAnalyses).orderBy(desc(gitAnalyses.analyzedAt)),
    ]);
    const repositoriesById = new Map(
      repositoryRows.map((repository) => [repository.id, repository]),
    );
    const latestByRepository = new Map<string, typeof gitAnalyses.$inferSelect>();
    for (const analysis of analyses)
      if (!latestByRepository.has(analysis.repositoryId))
        latestByRepository.set(analysis.repositoryId, analysis);
    const technologyMap = new Map<
      string,
      {
        slug: string;
        name: string;
        category: string;
        repositories: ReturnType<typeof toListItem>[];
      }
    >();
    for (const [repositoryId, analysis] of latestByRepository) {
      const repository = repositoriesById.get(repositoryId);
      if (!repository) continue;
      for (const technology of analysis.detectedTechnologies ?? []) {
        const slug = technologySlug(technology.name);
        const existing = technologyMap.get(slug) ?? {
          slug,
          name: technology.name,
          category: technology.category,
          repositories: [],
        };
        existing.repositories.push(toListItem(repository));
        technologyMap.set(slug, existing);
      }
    }
    return [...technologyMap.values()]
      .map((technology) => ({ ...technology, repositoryCount: technology.repositories.length }))
      .sort(
        (left, right) =>
          right.repositoryCount - left.repositoryCount || left.name.localeCompare(right.name),
      );
  } catch {
    return [];
  }
}

export async function getTechnologyReadModel(slug: string) {
  const technologies = await getTechnologiesReadModel();
  return technologies.find((technology) => technology.slug === slug) ?? null;
}
