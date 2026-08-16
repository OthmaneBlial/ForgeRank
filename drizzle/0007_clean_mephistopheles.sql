CREATE TABLE "ecosystem_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecosystem_type" text NOT NULL,
	"ecosystem_key" text NOT NULL,
	"ecosystem_name" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"repository_count" integer NOT NULL,
	"scored_repository_count" integer NOT NULL,
	"git_analyzed_repository_count" integer NOT NULL,
	"active_repository_count_90d" integer NOT NULL,
	"total_stars" bigint NOT NULL,
	"total_commits_90d" bigint,
	"average_score" numeric(7, 2),
	"average_momentum" numeric(9, 2),
	"snapshot_version" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ecosystem_snapshot_unique" ON "ecosystem_snapshots" USING btree ("ecosystem_type","ecosystem_key","observed_at");--> statement-breakpoint
CREATE INDEX "ecosystem_snapshot_lookup_idx" ON "ecosystem_snapshots" USING btree ("ecosystem_type","ecosystem_key","observed_at");