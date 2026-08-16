CREATE TABLE "developer_profile_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"action" text NOT NULL,
	"field" text,
	"value" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "visibility" text DEFAULT 'PUBLIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "visibility_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "visibility_reason" text;--> statement-breakpoint
ALTER TABLE "developer_profile_events" ADD CONSTRAINT "developer_profile_events_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "developer_profile_events_developer_time_idx" ON "developer_profile_events" USING btree ("developer_id","created_at");--> statement-breakpoint
CREATE INDEX "developers_visibility_score_idx" ON "developers" USING btree ("visibility","current_score");