CREATE TABLE "collection_repositories" (
	"collection_slug" text NOT NULL,
	"repository_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"note" text,
	CONSTRAINT "collection_repositories_collection_slug_repository_id_pk" PRIMARY KEY("collection_slug","repository_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"curator" text DEFAULT 'ForgeRank' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"repository_id" uuid,
	"source" text NOT NULL,
	"error_code" text NOT NULL,
	"message" text NOT NULL,
	"retryable" boolean NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"canonical_username" text NOT NULL,
	"display_name" text,
	"bio" text,
	"location" text,
	"avatar_url" text,
	"source_url" text NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"current_score" numeric(5, 1),
	"score_confidence" text DEFAULT 'INSUFFICIENT' NOT NULL,
	"score_version" text
);
--> statement-breakpoint
CREATE TABLE "git_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"strategy" text NOT NULL,
	"latest_commit_at" timestamp with time zone,
	"oldest_known_commit_at" timestamp with time zone,
	"commits_30d" integer,
	"commits_90d" integer,
	"active_weeks_12" integer,
	"unique_authors_90d" integer,
	"top_contributor_share" numeric(6, 5),
	"top_three_contributor_share" numeric(6, 5),
	"concentration_index" numeric(7, 6),
	"tag_count" integer,
	"detected_technologies" jsonb,
	"quality_signals" jsonb,
	"analysis_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"repository_count" integer DEFAULT 0 NOT NULL,
	"total_stars" integer DEFAULT 0 NOT NULL,
	"average_momentum" numeric(7, 2),
	"calculated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"repository_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score" numeric(8, 2) NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL,
	"ranking_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host" text DEFAULT 'github.com' NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"canonical_key" text NOT NULL,
	"description" text,
	"homepage" text,
	"default_branch" text,
	"primary_language" text,
	"license" text,
	"state" text DEFAULT 'ACTIVE' NOT NULL,
	"is_fork" boolean,
	"is_archived" boolean DEFAULT false NOT NULL,
	"repository_created_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"last_successful_fetch_at" timestamp with time zone,
	"source_url" text NOT NULL,
	"parser_version" text,
	"source_version" text,
	"metadata_confidence" text DEFAULT 'INSUFFICIENT' NOT NULL,
	"current_stars" integer,
	"current_forks" integer,
	"current_score" numeric(5, 1),
	"current_momentum_score" numeric(7, 2),
	"current_health_score" numeric(5, 1),
	"current_community_score" numeric(5, 1),
	"current_engineering_score" numeric(5, 1),
	"score_confidence" text DEFAULT 'INSUFFICIENT' NOT NULL,
	"score_version" text,
	"score_calculated_at" timestamp with time zone,
	"maturity" text,
	"last_activity_at" timestamp with time zone,
	"rank" integer,
	"previous_rank" integer
);
--> statement-breakpoint
CREATE TABLE "repository_contributors" (
	"repository_id" uuid NOT NULL,
	"contributor_key" text NOT NULL,
	"developer_id" uuid,
	"display_name" text NOT NULL,
	"identity_kind" text DEFAULT 'GIT_AUTHOR' NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"commits" integer NOT NULL,
	"first_commit_at" timestamp with time zone,
	"last_commit_at" timestamp with time zone,
	CONSTRAINT "repository_contributors_repository_id_contributor_key_pk" PRIMARY KEY("repository_id","contributor_key")
);
--> statement-breakpoint
CREATE TABLE "repository_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"stars" integer,
	"forks" integer,
	"last_commit_at" timestamp with time zone,
	"commit_count_30d" integer,
	"contributor_count_90d" integer,
	"top_contributor_share" numeric(6, 5),
	"forge_score" numeric(5, 1),
	"impact_score" numeric(5, 1),
	"momentum_score" numeric(5, 1),
	"health_score" numeric(5, 1),
	"community_score" numeric(5, 1),
	"engineering_score" numeric(5, 1),
	"trust_score" numeric(5, 1),
	"confidence" text NOT NULL,
	"parser_version" text NOT NULL,
	"score_version" text,
	"anomaly_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_topics" (
	"repository_id" uuid NOT NULL,
	"topic_slug" text NOT NULL,
	"confidence" text NOT NULL,
	"evidence" text,
	CONSTRAINT "repository_topics_repository_id_topic_slug_pk" PRIMARY KEY("repository_id","topic_slug")
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"status" integer NOT NULL,
	"content_type" text,
	"etag" text,
	"last_modified" text,
	"content_sha256" text,
	"parser_version" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"duration_ms" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "collection_repositories" ADD CONSTRAINT "collection_repositories_collection_slug_collections_slug_fk" FOREIGN KEY ("collection_slug") REFERENCES "public"."collections"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_repositories" ADD CONSTRAINT "collection_repositories_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_failures" ADD CONSTRAINT "crawl_failures_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_failures" ADD CONSTRAINT "crawl_failures_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_analyses" ADD CONSTRAINT "git_analyses_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_contributors" ADD CONSTRAINT "repository_contributors_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_contributors" ADD CONSTRAINT "repository_contributors_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_snapshots" ADD CONSTRAINT "repository_snapshots_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_topics" ADD CONSTRAINT "repository_topics_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_topics" ADD CONSTRAINT "repository_topics_topic_slug_topics_slug_fk" FOREIGN KEY ("topic_slug") REFERENCES "public"."topics"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawl_failures_time_idx" ON "crawl_failures" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_jobs_active_dedupe_unique" ON "crawl_jobs" USING btree ("deduplication_key") WHERE "crawl_jobs"."status" in ('QUEUED', 'RUNNING');--> statement-breakpoint
CREATE INDEX "crawl_jobs_claim_idx" ON "crawl_jobs" USING btree ("status","available_at","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "developers_canonical_username_unique" ON "developers" USING btree ("canonical_username");--> statement-breakpoint
CREATE INDEX "git_analyses_repo_time_idx" ON "git_analyses" USING btree ("repository_id","analyzed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "languages_name_unique" ON "languages" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_snapshot_unique" ON "ranking_snapshots" USING btree ("scope","period","repository_id","calculated_at");--> statement-breakpoint
CREATE INDEX "ranking_snapshot_lookup_idx" ON "ranking_snapshots" USING btree ("scope","period","calculated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_canonical_key_unique" ON "repositories" USING btree ("canonical_key");--> statement-breakpoint
CREATE INDEX "repositories_score_idx" ON "repositories" USING btree ("current_score");--> statement-breakpoint
CREATE INDEX "repositories_language_score_idx" ON "repositories" USING btree ("primary_language","current_score");--> statement-breakpoint
CREATE INDEX "repositories_momentum_idx" ON "repositories" USING btree ("current_momentum_score");--> statement-breakpoint
CREATE INDEX "repositories_discovered_at_idx" ON "repositories" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "repositories_last_indexed_at_idx" ON "repositories" USING btree ("last_indexed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_snapshots_entity_time_unique" ON "repository_snapshots" USING btree ("repository_id","observed_at");--> statement-breakpoint
CREATE INDEX "repository_snapshots_chart_idx" ON "repository_snapshots" USING btree ("repository_id","observed_at");--> statement-breakpoint
CREATE INDEX "source_documents_url_time_idx" ON "source_documents" USING btree ("source_url","fetched_at");