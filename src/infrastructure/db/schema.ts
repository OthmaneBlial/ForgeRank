import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { RepositoryScoreReason } from "@/domain/repository";
import type { ReadmeAnalysis } from "@/domain/readme-analysis";

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    host: text("host").notNull().default("github.com"),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    canonicalKey: text("canonical_key").notNull(),
    description: text("description"),
    homepage: text("homepage"),
    defaultBranch: text("default_branch"),
    primaryLanguage: text("primary_language"),
    license: text("license"),
    state: text("state").notNull().default("ACTIVE"),
    isFork: boolean("is_fork"),
    isArchived: boolean("is_archived").notNull().default(false),
    repositoryCreatedAt: timestamp("repository_created_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    lastSuccessfulFetchAt: timestamp("last_successful_fetch_at", { withTimezone: true }),
    sourceUrl: text("source_url").notNull(),
    parserVersion: text("parser_version"),
    sourceVersion: text("source_version"),
    metadataConfidence: text("metadata_confidence").notNull().default("INSUFFICIENT"),
    currentStars: integer("current_stars"),
    currentForks: integer("current_forks"),
    currentScore: numeric("current_score", { precision: 5, scale: 1 }),
    scoreReasons: jsonb("score_reasons").$type<RepositoryScoreReason[]>().notNull().default([]),
    currentMomentumScore: numeric("current_momentum_score", { precision: 7, scale: 2 }),
    currentHealthScore: numeric("current_health_score", { precision: 5, scale: 1 }),
    currentCommunityScore: numeric("current_community_score", { precision: 5, scale: 1 }),
    currentEngineeringScore: numeric("current_engineering_score", { precision: 5, scale: 1 }),
    scoreConfidence: text("score_confidence").notNull().default("INSUFFICIENT"),
    scoreVersion: text("score_version"),
    scoreCalculatedAt: timestamp("score_calculated_at", { withTimezone: true }),
    maturity: text("maturity"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    rank: integer("rank"),
    previousRank: integer("previous_rank"),
    refreshTier: text("refresh_tier").notNull().default("NORMAL"),
    nextRefreshAt: timestamp("next_refresh_at", { withTimezone: true }),
    lastRefreshRequestedAt: timestamp("last_refresh_requested_at", { withTimezone: true }),
    refreshRequestCount: integer("refresh_request_count").notNull().default(0),
    pageViewCount: integer("page_view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("repositories_canonical_key_unique").on(table.canonicalKey),
    index("repositories_score_idx").on(table.currentScore),
    index("repositories_language_score_idx").on(table.primaryLanguage, table.currentScore),
    index("repositories_stars_idx").on(table.currentStars),
    index("repositories_forks_idx").on(table.currentForks),
    index("repositories_momentum_idx").on(table.currentMomentumScore),
    index("repositories_health_idx").on(table.currentHealthScore),
    index("repositories_community_idx").on(table.currentCommunityScore),
    index("repositories_created_at_idx").on(table.repositoryCreatedAt),
    index("repositories_maturity_idx").on(table.maturity),
    index("repositories_discovered_at_idx").on(table.discoveredAt),
    index("repositories_last_indexed_at_idx").on(table.lastIndexedAt),
    index("repositories_refresh_due_idx").on(table.nextRefreshAt, table.refreshTier),
    index("repositories_search_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${table.fullName}, '') || ' ' || coalesce(${table.owner}, '') || ' ' || coalesce(${table.description}, '') || ' ' || coalesce(${table.primaryLanguage}, ''))`,
    ),
    index("repositories_full_name_trgm_idx").using("gin", table.fullName.op("gin_trgm_ops")),
    index("repositories_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
  ],
);

export const repositorySnapshots = pgTable(
  "repository_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    stars: integer("stars"),
    forks: integer("forks"),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
    commitCount30d: integer("commit_count_30d"),
    contributorCount90d: integer("contributor_count_90d"),
    topContributorShare: numeric("top_contributor_share", { precision: 6, scale: 5 }),
    forgeScore: numeric("forge_score", { precision: 5, scale: 1 }),
    impactScore: numeric("impact_score", { precision: 5, scale: 1 }),
    momentumScore: numeric("momentum_score", { precision: 5, scale: 1 }),
    healthScore: numeric("health_score", { precision: 5, scale: 1 }),
    communityScore: numeric("community_score", { precision: 5, scale: 1 }),
    engineeringScore: numeric("engineering_score", { precision: 5, scale: 1 }),
    trustScore: numeric("trust_score", { precision: 5, scale: 1 }),
    confidence: text("confidence").notNull(),
    parserVersion: text("parser_version").notNull(),
    scoreVersion: text("score_version"),
    scoreReasons: jsonb("score_reasons").$type<RepositoryScoreReason[]>().notNull().default([]),
    anomalyFlags: jsonb("anomaly_flags").$type<string[]>().notNull().default([]),
    provenance: jsonb("provenance")
      .$type<Record<string, { source: string; observedAt: string; parserVersion: string }>>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("repository_snapshots_entity_time_unique").on(table.repositoryId, table.observedAt),
    index("repository_snapshots_chart_idx").on(table.repositoryId, table.observedAt),
  ],
);

export const repositoryAliases = pgTable(
  "repository_aliases",
  {
    canonicalKey: text("canonical_key").primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("repository_aliases_repo_idx").on(table.repositoryId)],
);

export const gitAnalyses = pgTable(
  "git_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
    strategy: text("strategy").notNull(),
    latestCommitAt: timestamp("latest_commit_at", { withTimezone: true }),
    oldestKnownCommitAt: timestamp("oldest_known_commit_at", { withTimezone: true }),
    commits30d: integer("commits_30d"),
    commits90d: integer("commits_90d"),
    activeWeeks12: integer("active_weeks_12"),
    previousDormantPeriodDays: integer("previous_dormant_period_days"),
    uniqueAuthors90d: integer("unique_authors_90d"),
    topContributorShare: numeric("top_contributor_share", { precision: 6, scale: 5 }),
    topThreeContributorShare: numeric("top_three_contributor_share", {
      precision: 6,
      scale: 5,
    }),
    concentrationIndex: numeric("concentration_index", { precision: 7, scale: 6 }),
    tagCount: integer("tag_count"),
    detectedTechnologies:
      jsonb("detected_technologies").$type<
        Array<{ name: string; category: string; confidence: string; evidence: string }>
      >(),
    qualitySignals: jsonb("quality_signals").$type<Record<string, boolean | null>>(),
    readmeAnalysis: jsonb("readme_analysis").$type<ReadmeAnalysis>(),
    analysisVersion: text("analysis_version").notNull(),
  },
  (table) => [index("git_analyses_repo_time_idx").on(table.repositoryId, table.analyzedAt)],
);

export const developers = pgTable(
  "developers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    canonicalUsername: text("canonical_username").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    location: text("location"),
    avatarUrl: text("avatar_url"),
    sourceUrl: text("source_url").notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    currentScore: numeric("current_score", { precision: 5, scale: 1 }),
    scoreConfidence: text("score_confidence").notNull().default("INSUFFICIENT"),
    scoreVersion: text("score_version"),
    scoreCalculatedAt: timestamp("score_calculated_at", { withTimezone: true }),
    parserVersion: text("parser_version"),
    metadataConfidence: text("metadata_confidence").notNull().default("INSUFFICIENT"),
    visibility: text("visibility").notNull().default("PUBLIC"),
    visibilityUpdatedAt: timestamp("visibility_updated_at", { withTimezone: true }),
    visibilityReason: text("visibility_reason"),
  },
  (table) => [
    uniqueIndex("developers_canonical_username_unique").on(table.canonicalUsername),
    index("developers_visibility_score_idx").on(table.visibility, table.currentScore),
    index("developers_search_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${table.username}, '') || ' ' || coalesce(${table.displayName}, '') || ' ' || coalesce(${table.bio}, ''))`,
    ),
    index("developers_username_trgm_idx").using("gin", table.username.op("gin_trgm_ops")),
  ],
);

export const developerSnapshots = pgTable(
  "developer_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    repositoriesIndexed: integer("repositories_indexed").notNull().default(0),
    ownedOriginalStars: integer("owned_original_stars"),
    forgeScore: numeric("forge_score", { precision: 5, scale: 1 }),
    impactScore: numeric("impact_score", { precision: 5, scale: 1 }),
    consistencyScore: numeric("consistency_score", { precision: 5, scale: 1 }),
    collaborationScore: numeric("collaboration_score", { precision: 5, scale: 1 }),
    projectQualityScore: numeric("project_quality_score", { precision: 5, scale: 1 }),
    breadthScore: numeric("breadth_score", { precision: 5, scale: 1 }),
    trustScore: numeric("trust_score", { precision: 5, scale: 1 }),
    confidence: text("confidence").notNull(),
    parserVersion: text("parser_version").notNull(),
    scoreVersion: text("score_version"),
    provenance: jsonb("provenance")
      .$type<Record<string, { source: string; observedAt: string; parserVersion: string }>>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("developer_snapshots_entity_time_unique").on(table.developerId, table.observedAt),
    index("developer_snapshots_chart_idx").on(table.developerId, table.observedAt),
  ],
);

export const developerProfileEvents = pgTable(
  "developer_profile_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    field: text("field"),
    value: text("value"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("developer_profile_events_developer_time_idx").on(table.developerId, table.createdAt),
  ],
);

export const repositoryContributors = pgTable(
  "repository_contributors",
  {
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    contributorKey: text("contributor_key").notNull(),
    developerId: uuid("developer_id").references(() => developers.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    identityKind: text("identity_kind").notNull().default("GIT_AUTHOR"),
    isBot: boolean("is_bot").notNull().default(false),
    commits: integer("commits").notNull(),
    firstCommitAt: timestamp("first_commit_at", { withTimezone: true }),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.contributorKey] })],
);

export const languages = pgTable(
  "languages",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    color: text("color"),
    repositoryCount: integer("repository_count").notNull().default(0),
    totalStars: integer("total_stars").notNull().default(0),
    averageMomentum: numeric("average_momentum", { precision: 7, scale: 2 }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("languages_name_unique").on(table.name)],
);

export const topics = pgTable(
  "topics",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (table) => [index("topics_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops"))],
);

export const repositoryTopics = pgTable(
  "repository_topics",
  {
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    topicSlug: text("topic_slug")
      .notNull()
      .references(() => topics.slug, { onDelete: "cascade" }),
    confidence: text("confidence").notNull(),
    evidence: text("evidence"),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.topicSlug] })],
);

export const collections = pgTable(
  "collections",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    curator: text("curator").notNull().default("ForgeRank"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("collections_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops"))],
);

export const collectionRepositories = pgTable(
  "collection_repositories",
  {
    collectionSlug: text("collection_slug")
      .notNull()
      .references(() => collections.slug, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    note: text("note"),
  },
  (table) => [primaryKey({ columns: [table.collectionSlug, table.repositoryId] })],
);

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: text("scope").notNull(),
    period: text("period").notNull(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    score: numeric("score", { precision: 8, scale: 2 }).notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull(),
    rankingVersion: text("ranking_version").notNull(),
  },
  (table) => [
    uniqueIndex("ranking_snapshot_unique").on(
      table.scope,
      table.period,
      table.repositoryId,
      table.calculatedAt,
    ),
    index("ranking_snapshot_lookup_idx").on(table.scope, table.period, table.calculatedAt),
  ],
);

export const ecosystemSnapshots = pgTable(
  "ecosystem_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ecosystemType: text("ecosystem_type").notNull(),
    ecosystemKey: text("ecosystem_key").notNull(),
    ecosystemName: text("ecosystem_name").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    repositoryCount: integer("repository_count").notNull(),
    scoredRepositoryCount: integer("scored_repository_count").notNull(),
    gitAnalyzedRepositoryCount: integer("git_analyzed_repository_count").notNull(),
    activeRepositoryCount90d: integer("active_repository_count_90d").notNull(),
    totalStars: bigint("total_stars", { mode: "number" }).notNull(),
    totalCommits90d: bigint("total_commits_90d", { mode: "number" }),
    averageScore: numeric("average_score", { precision: 7, scale: 2 }),
    averageMomentum: numeric("average_momentum", { precision: 9, scale: 2 }),
    snapshotVersion: text("snapshot_version").notNull(),
  },
  (table) => [
    uniqueIndex("ecosystem_snapshot_unique").on(
      table.ecosystemType,
      table.ecosystemKey,
      table.observedAt,
    ),
    index("ecosystem_snapshot_lookup_idx").on(
      table.ecosystemType,
      table.ecosystemKey,
      table.observedAt,
    ),
  ],
);

export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    status: text("status").notNull().default("QUEUED"),
    priority: integer("priority").notNull().default(0),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("crawl_jobs_active_dedupe_unique")
      .on(table.deduplicationKey)
      .where(sql`${table.status} in ('QUEUED', 'RUNNING')`),
    index("crawl_jobs_claim_idx").on(table.status, table.availableAt, table.priority),
  ],
);

export const crawlFailures = pgTable(
  "crawl_failures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => crawlJobs.id, { onDelete: "set null" }),
    repositoryId: uuid("repository_id").references(() => repositories.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(),
    errorCode: text("error_code").notNull(),
    message: text("message").notNull(),
    retryable: boolean("retryable").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("crawl_failures_time_idx").on(table.occurredAt)],
);

export const crawlRequestEvents = pgTable(
  "crawl_request_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    host: text("host").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("crawl_request_events_time_idx").on(table.requestedAt),
    index("crawl_request_events_host_time_idx").on(table.host, table.requestedAt),
  ],
);

export const crawlHostStates = pgTable("crawl_host_states", {
  host: text("host").primaryKey(),
  lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  openedUntil: timestamp("opened_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    key: text("key").primaryKey(),
    action: text("action").notNull(),
    clientHash: text("client_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rate_limit_windows_updated_idx").on(table.updatedAt)],
);

export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceUrl: text("source_url").notNull(),
    status: integer("status").notNull(),
    contentType: text("content_type"),
    etag: text("etag"),
    lastModified: text("last_modified"),
    contentSha256: text("content_sha256"),
    parserVersion: text("parser_version"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    cacheHit: boolean("cache_hit").notNull().default(false),
    durationMs: integer("duration_ms").notNull(),
  },
  (table) => [index("source_documents_url_time_idx").on(table.sourceUrl, table.fetchedAt)],
);

export const systemState = pgTable("system_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  repositories,
  repositorySnapshots,
  repositoryAliases,
  gitAnalyses,
  developers,
  developerSnapshots,
  developerProfileEvents,
  repositoryContributors,
  languages,
  topics,
  repositoryTopics,
  collections,
  collectionRepositories,
  rankingSnapshots,
  ecosystemSnapshots,
  crawlJobs,
  crawlFailures,
  crawlRequestEvents,
  crawlHostStates,
  rateLimitWindows,
  sourceDocuments,
  systemState,
};
