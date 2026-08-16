import { createHash } from "node:crypto";

import { PublicHtmlFetcher } from "@/infrastructure/github-public/fetcher";
import { parseDeveloperHtml } from "@/infrastructure/github-public/developer-parser";
import { parseGitHubUsername } from "@/infrastructure/github-public/developer-url";
import { persistDeveloperSnapshot } from "@/infrastructure/db/developer-store";
import { getDatabase } from "@/infrastructure/db/client";
import { sourceDocuments } from "@/infrastructure/db/schema";
import { recalculateDeveloper } from "./recalculate-developer";

export class IndexDeveloperService {
  constructor(private readonly fetcher = new PublicHtmlFetcher()) {}
  async execute(input: string, options?: { force?: boolean }) {
    const identity = parseGitHubUsername(input);
    const document = await this.fetcher.fetchDocument(identity.sourceUrl, {
      force: options?.force,
      kind: "profile",
    });
    const observedIdentity = parseGitHubUsername(document.url);
    const snapshot = parseDeveloperHtml(
      document.body,
      observedIdentity,
      new Date(document.fetchedAt),
    );
    const developerId = await persistDeveloperSnapshot(snapshot);
    const database = await getDatabase();
    await database.insert(sourceDocuments).values({
      sourceUrl: document.url,
      status: document.status,
      contentType: document.contentType,
      etag: document.etag,
      lastModified: document.lastModified,
      contentSha256: createHash("sha256").update(document.body).digest("hex"),
      parserVersion: snapshot.parserVersion,
      fetchedAt: snapshot.observedAt,
      cacheHit: document.cacheHit,
      durationMs: document.durationMs,
    });
    await recalculateDeveloper(developerId);
    return {
      developerId,
      username: snapshot.username,
      displayName: snapshot.displayName,
      confidence: snapshot.confidence,
      cacheHit: document.cacheHit,
    };
  }
}
