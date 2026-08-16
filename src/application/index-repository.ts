import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { REFRESH_INTERVAL_MS, type RefreshTier } from "@/domain/refresh-policy";
import { parseRepositoryHtml } from "@/infrastructure/github-public/parser";
import { PublicHtmlFetcher } from "@/infrastructure/github-public/fetcher";
import { parseGitHubRepositoryInput } from "@/infrastructure/github-public/url";
import {
  persistRepositoryAlias,
  persistRepositorySnapshot,
} from "@/infrastructure/db/repository-store";
import { getDatabase } from "@/infrastructure/db/client";
import { repositories, sourceDocuments } from "@/infrastructure/db/schema";
import { recalculateRepository } from "./recalculate-repository";
import { classifyRepositoryTopics } from "./classify-repository-topics";

export type IndexRepositoryResult = {
  repositoryId: string;
  fullName: string;
  stars: number | null;
  forks: number | null;
  confidence: string;
  cacheHit: boolean;
};

export class IndexRepositoryService {
  constructor(private readonly fetcher = new PublicHtmlFetcher()) {}

  async execute(input: string, options?: { force?: boolean }): Promise<IndexRepositoryResult> {
    const identity = parseGitHubRepositoryInput(input);
    const document = await this.fetcher.fetchDocument(identity.sourceUrl, options);
    const observedIdentity = parseGitHubRepositoryInput(document.url);
    const snapshot = parseRepositoryHtml(
      document.body,
      observedIdentity,
      new Date(document.fetchedAt),
    );
    const repositoryId = await persistRepositorySnapshot(snapshot);
    if (identity.fullName.toLowerCase() !== observedIdentity.fullName.toLowerCase()) {
      await persistRepositoryAlias(identity.fullName, repositoryId);
    }
    const database = await getDatabase();
    await database.insert(sourceDocuments).values({
      sourceUrl: identity.sourceUrl,
      status: document.status,
      contentType: document.contentType,
      etag: document.etag,
      lastModified: document.lastModified,
      contentSha256: createHash("sha256").update(document.body).digest("hex"),
      parserVersion: snapshot.parserVersion,
      fetchedAt: new Date(document.fetchedAt),
      cacheHit: document.cacheHit,
      durationMs: document.durationMs,
    });
    await recalculateRepository(repositoryId);
    await classifyRepositoryTopics(repositoryId);
    const completedAt = new Date();
    const [repository] = await database
      .select({ refreshTier: repositories.refreshTier })
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);
    const refreshTier = (repository?.refreshTier ?? "NORMAL") as RefreshTier;
    await database
      .update(repositories)
      .set({
        lastIndexedAt: completedAt,
        nextRefreshAt: new Date(completedAt.getTime() + REFRESH_INTERVAL_MS[refreshTier]),
      })
      .where(eq(repositories.id, repositoryId));

    return {
      repositoryId,
      fullName: snapshot.fullName,
      stars: snapshot.stars,
      forks: snapshot.forks,
      confidence: snapshot.confidence,
      cacheHit: document.cacheHit,
    };
  }
}
