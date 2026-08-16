CREATE TABLE "repository_aliases" (
	"canonical_key" text PRIMARY KEY NOT NULL,
	"repository_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repository_aliases" ADD CONSTRAINT "repository_aliases_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repository_aliases_repo_idx" ON "repository_aliases" USING btree ("repository_id");