CREATE TABLE "developer_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"repositories_indexed" integer DEFAULT 0 NOT NULL,
	"owned_original_stars" integer,
	"forge_score" numeric(5, 1),
	"impact_score" numeric(5, 1),
	"consistency_score" numeric(5, 1),
	"collaboration_score" numeric(5, 1),
	"project_quality_score" numeric(5, 1),
	"breadth_score" numeric(5, 1),
	"trust_score" numeric(5, 1),
	"confidence" text NOT NULL,
	"parser_version" text NOT NULL,
	"score_version" text,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "score_calculated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "parser_version" text;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "metadata_confidence" text DEFAULT 'INSUFFICIENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "developer_snapshots" ADD CONSTRAINT "developer_snapshots_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "developer_snapshots_entity_time_unique" ON "developer_snapshots" USING btree ("developer_id","observed_at");--> statement-breakpoint
CREATE INDEX "developer_snapshots_chart_idx" ON "developer_snapshots" USING btree ("developer_id","observed_at");