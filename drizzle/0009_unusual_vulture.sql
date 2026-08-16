CREATE INDEX "repositories_stars_idx" ON "repositories" USING btree ("current_stars");--> statement-breakpoint
CREATE INDEX "repositories_forks_idx" ON "repositories" USING btree ("current_forks");--> statement-breakpoint
CREATE INDEX "repositories_health_idx" ON "repositories" USING btree ("current_health_score");--> statement-breakpoint
CREATE INDEX "repositories_community_idx" ON "repositories" USING btree ("current_community_score");--> statement-breakpoint
CREATE INDEX "repositories_created_at_idx" ON "repositories" USING btree ("repository_created_at");--> statement-breakpoint
CREATE INDEX "repositories_maturity_idx" ON "repositories" USING btree ("maturity");