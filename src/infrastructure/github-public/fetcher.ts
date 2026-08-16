import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import robotsParser from "robots-parser";
import { fetch } from "undici";
import { z } from "zod";

import { ConservativeRequestPolicy } from "./request-policy";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ROBOTS_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

const cacheEntrySchema = z.object({
  url: z.url(),
  status: z.number().int(),
  contentType: z.string().nullable(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  fetchedAt: z.string(),
  body: z.string(),
});

type CacheEntry = z.infer<typeof cacheEntrySchema>;

export type PublicDocument = CacheEntry & {
  cacheHit: boolean;
  durationMs: number;
};

export type PublicDocumentKind = "repository" | "profile";

export class PublicDocumentFetchError extends Error {
  override name = "PublicDocumentFetchError";

  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class PublicHtmlFetcher {
  private readonly policy: ConservativeRequestPolicy;
  private readonly cacheDirectory: string;
  private readonly userAgent: string;

  constructor(options?: { policy?: ConservativeRequestPolicy; cacheDirectory?: string }) {
    this.policy = options?.policy ?? new ConservativeRequestPolicy();
    this.cacheDirectory =
      options?.cacheDirectory ??
      path.join(process.env.FORGERANK_DATA_DIR ?? path.join(process.cwd(), "data"), "http-cache");
    const contact = process.env.FORGERANK_CONTACT_URL ?? "https://github.com/forgerank/forgerank";
    this.userAgent = `ForgeRank/0.1 (+${contact})`;
  }

  async fetchDocument(
    sourceUrl: string,
    options?: { force?: boolean; kind?: PublicDocumentKind },
    redirectCount = 0,
  ): Promise<PublicDocument> {
    const kind = options?.kind ?? "repository";
    const url = this.validateSourceUrl(sourceUrl, kind);
    const cached = await this.readCache(url);
    const ttlMs = Number(process.env.HTTP_CACHE_TTL_SECONDS ?? 21_600) * 1_000;
    if (!options?.force && cached && Date.now() - Date.parse(cached.fetchedAt) < ttlMs) {
      return { ...cached, cacheHit: true, durationMs: 0 };
    }

    await this.assertRobotsAllowed(url);
    await this.policy.beforeRequest(url);
    const startedAt = performance.now();
    const maxRetries = Number(process.env.MAX_RETRIES ?? 2);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const headers: Record<string, string> = {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.7",
          "User-Agent": this.userAgent,
        };
        if (cached?.etag) headers["If-None-Match"] = cached.etag;
        if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

        const response = await fetch(url, {
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(20_000),
        });
        const durationMs = Math.round(performance.now() - startedAt);

        if (response.status === 304 && cached) {
          const refreshed = { ...cached, fetchedAt: new Date().toISOString() };
          await this.writeCache(url, refreshed);
          await this.policy.recordSuccess(url.host);
          return { ...refreshed, cacheHit: true, durationMs };
        }

        if ([301, 302, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location)
            throw new PublicDocumentFetchError(
              "Redirect had no destination.",
              "INVALID_REDIRECT",
              false,
            );
          const destination = new URL(location, url);
          if (destination.hostname !== "github.com" || destination.protocol !== "https:") {
            throw new PublicDocumentFetchError(
              "Cross-host redirects are not followed.",
              "UNSAFE_REDIRECT",
              false,
            );
          }
          const parts = destination.pathname.split("/").filter(Boolean);
          const expectedParts = kind === "repository" ? 2 : 1;
          if (parts.length !== expectedParts || redirectCount >= 2) {
            throw new PublicDocumentFetchError(
              "The repository redirect was not a safe canonical repository path.",
              "INVALID_REDIRECT",
              false,
            );
          }
          return this.fetchDocument(destination.toString(), options, redirectCount + 1);
        }

        if (response.status === 429 || response.status === 403) {
          const retryAfter = this.parseRetryAfter(response.headers.get("retry-after"));
          throw new PublicDocumentFetchError(
            retryAfter
              ? `The source requested a pause until ${new Date(retryAfter).toISOString()}.`
              : "The source declined this request. ForgeRank will continue serving cached data.",
            "SOURCE_RATE_LIMITED",
            false,
          );
        }

        if (response.status === 404) {
          throw new PublicDocumentFetchError(
            "The public repository page was not found.",
            "NOT_FOUND",
            false,
          );
        }

        if (!response.ok) {
          throw new PublicDocumentFetchError(
            `The source returned HTTP ${response.status}.`,
            "SOURCE_HTTP_ERROR",
            response.status >= 500,
          );
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.toLowerCase().includes("text/html")) {
          throw new PublicDocumentFetchError(
            "The source did not return HTML.",
            "INVALID_CONTENT_TYPE",
            false,
          );
        }
        const contentLength = Number(response.headers.get("content-length") ?? 0);
        if (contentLength > MAX_DOCUMENT_BYTES) {
          throw new PublicDocumentFetchError(
            "The public document exceeds ForgeRank's size limit.",
            "DOCUMENT_TOO_LARGE",
            false,
          );
        }

        const body = await response.text();
        if (Buffer.byteLength(body, "utf8") > MAX_DOCUMENT_BYTES) {
          throw new PublicDocumentFetchError(
            "The public document exceeds ForgeRank's size limit.",
            "DOCUMENT_TOO_LARGE",
            false,
          );
        }

        const entry: CacheEntry = {
          url: url.toString(),
          status: response.status,
          contentType,
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          fetchedAt: new Date().toISOString(),
          body,
        };
        await this.writeCache(url, entry);
        await this.policy.recordSuccess(url.host);
        return { ...entry, cacheHit: false, durationMs };
      } catch (error) {
        const fetchError =
          error instanceof PublicDocumentFetchError
            ? error
            : new PublicDocumentFetchError(
                error instanceof Error ? error.message : "Unknown fetch failure.",
                "NETWORK_ERROR",
                true,
              );
        if (!fetchError.retryable || attempt === maxRetries) {
          await this.policy.recordFailure(url.host);
          throw fetchError;
        }
        await delay(Math.min(8_000, 750 * 2 ** attempt));
      }
    }

    throw new PublicDocumentFetchError("The fetch attempt ended unexpectedly.", "UNKNOWN", false);
  }

  private validateSourceUrl(sourceUrl: string, kind: PublicDocumentKind): URL {
    const url = new URL(sourceUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new PublicDocumentFetchError(
        "Only public HTTPS github.com pages are supported.",
        "UNSAFE_URL",
        false,
      );
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== (kind === "repository" ? 2 : 1)) {
      throw new PublicDocumentFetchError(
        `The public ${kind} URL is not a supported root path.`,
        "UNSAFE_URL",
        false,
      );
    }
    return url;
  }

  private async assertRobotsAllowed(url: URL): Promise<void> {
    const robotsUrl = new URL("/robots.txt", url.origin);
    const cachePath = this.cachePath(robotsUrl, "robots");
    let text: string | null = null;
    try {
      const cached = z
        .object({ fetchedAt: z.string(), body: z.string() })
        .parse(JSON.parse(await readFile(cachePath, "utf8")));
      if (Date.now() - Date.parse(cached.fetchedAt) < ROBOTS_CACHE_TTL_MS) text = cached.body;
    } catch {
      // A cache miss is expected on first run.
    }

    if (text === null) {
      const response = await fetch(robotsUrl, {
        headers: { "User-Agent": this.userAgent, Accept: "text/plain" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new PublicDocumentFetchError(
          "ForgeRank could not verify the source's robots policy, so it failed closed.",
          "ROBOTS_UNAVAILABLE",
          true,
        );
      }
      text = await response.text();
      await mkdir(this.cacheDirectory, { recursive: true });
      await writeFile(
        cachePath,
        JSON.stringify({ fetchedAt: new Date().toISOString(), body: text }),
        "utf8",
      );
    }

    const robots = robotsParser(robotsUrl.toString(), text);
    if (robots.isAllowed(url.toString(), this.userAgent) !== true) {
      throw new PublicDocumentFetchError(
        "Automated access to this public document is not allowed by robots.txt.",
        "ROBOTS_DISALLOWED",
        false,
      );
    }
  }

  private cachePath(url: URL, prefix = "document"): string {
    const hash = createHash("sha256").update(url.toString()).digest("hex");
    return path.join(this.cacheDirectory, `${prefix}-${hash}.json`);
  }

  private async readCache(url: URL): Promise<CacheEntry | null> {
    try {
      return cacheEntrySchema.parse(JSON.parse(await readFile(this.cachePath(url), "utf8")));
    } catch {
      return null;
    }
  }

  private async writeCache(url: URL, entry: CacheEntry): Promise<void> {
    await mkdir(this.cacheDirectory, { recursive: true });
    await writeFile(this.cachePath(url), JSON.stringify(entry), "utf8");
  }

  private parseRetryAfter(value: string | null): number | null {
    if (!value) return null;
    if (/^\d+$/.test(value)) return Date.now() + Number(value) * 1_000;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  }
}
