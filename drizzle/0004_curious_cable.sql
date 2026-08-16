CREATE TABLE "rate_limit_windows" (
	"key" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"client_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "refresh_tier" text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "next_refresh_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "last_refresh_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "refresh_request_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "page_view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "last_viewed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "rate_limit_windows_updated_idx" ON "rate_limit_windows" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "repositories_refresh_due_idx" ON "repositories" USING btree ("next_refresh_at","refresh_tier");