CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "collections_name_trgm_idx" ON "collections" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "developers_search_fts_idx" ON "developers" USING gin (to_tsvector('simple', coalesce("username", '') || ' ' || coalesce("display_name", '') || ' ' || coalesce("bio", '')));--> statement-breakpoint
CREATE INDEX "developers_username_trgm_idx" ON "developers" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "repositories_search_fts_idx" ON "repositories" USING gin (to_tsvector('simple', coalesce("full_name", '') || ' ' || coalesce("owner", '') || ' ' || coalesce("description", '') || ' ' || coalesce("primary_language", '')));--> statement-breakpoint
CREATE INDEX "repositories_full_name_trgm_idx" ON "repositories" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "repositories_name_trgm_idx" ON "repositories" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "topics_name_trgm_idx" ON "topics" USING gin ("name" gin_trgm_ops);
