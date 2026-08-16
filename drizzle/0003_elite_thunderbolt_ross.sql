CREATE TABLE "crawl_host_states" (
	"host" text PRIMARY KEY NOT NULL,
	"last_request_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"opened_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crawl_request_events_time_idx" ON "crawl_request_events" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "crawl_request_events_host_time_idx" ON "crawl_request_events" USING btree ("host","requested_at");