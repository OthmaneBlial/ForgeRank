import { load, type CheerioAPI } from "cheerio";
import { z } from "zod";

import type { Confidence } from "@/domain/confidence";
import type { RepositorySnapshotInput } from "@/domain/repository";

import { GITHUB_REPOSITORY_PARSER_VERSION, repositorySelectors } from "./selectors";
import type { GitHubRepositoryIdentifier } from "./url";

export class RepositoryParserError extends Error {
  override name = "RepositoryParserError";
}

function firstAttribute(
  $: CheerioAPI,
  selectors: readonly string[],
  attribute: string,
): string | null {
  for (const selector of selectors) {
    const value = $(selector).first().attr(attribute)?.trim();
    if (value) return value;
  }
  return null;
}

function firstText($: CheerioAPI, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const value = $(selector).first().text().replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return null;
}

export function parseHumanCount(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").trim().toLowerCase();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmb])?$/);
  if (!match?.[1]) return null;
  const base = Number(match[1]);
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[match[2] ?? ""] ?? 1;
  const result = Math.round(base * multiplier);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

function cleanDescription(description: string | null, fullName: string): string | null {
  if (!description) return null;
  const prefix = `GitHub - ${fullName}:`;
  const cleaned = description.startsWith(prefix)
    ? description.slice(prefix.length).trim()
    : description;
  return cleaned.length > 0 ? cleaned.slice(0, 600) : null;
}

export function parseRepositoryHtml(
  html: string,
  identity: GitHubRepositoryIdentifier,
  observedAt = new Date(),
): RepositorySnapshotInput {
  if (html.length < 300 || !/<html/i.test(html)) {
    throw new RepositoryParserError("The response does not look like a complete HTML document.");
  }
  const $ = load(html);
  const canonical = $(repositorySelectors.canonicalRepository).attr("content")?.trim();
  if (canonical && canonical.toLowerCase() !== identity.fullName.toLowerCase()) {
    throw new RepositoryParserError(
      `Expected ${identity.fullName}, but the page identifies ${canonical}.`,
    );
  }

  const stars = parseHumanCount(firstText($, repositorySelectors.stars));
  const forks = parseHumanCount(firstText($, repositorySelectors.forks));
  const rawDescription = firstAttribute($, repositorySelectors.description, "content");
  const primaryLanguage = $(repositorySelectors.language).first().text().trim() || null;
  const archivedText = $(repositorySelectors.archivedNotice).text();
  const isArchived = /archived/i.test(archivedText);
  const forkMetadata = $(repositorySelectors.isFork).attr("content")?.trim().toLowerCase();
  const forkText = $(repositorySelectors.forkNotice)
    .filter((_, element) => /forked from/i.test($(element).parent().text()))
    .first()
    .text();
  const isFork =
    forkMetadata === "true" ? true : forkMetadata === "false" ? false : forkText ? true : null;
  const defaultBranch = $(repositorySelectors.defaultBranch).first().text().trim() || null;
  const licenseHref = firstAttribute($, repositorySelectors.licenseLinks, "href");
  const license =
    licenseHref
      ?.split("/")
      .at(-1)
      ?.replace(/\.(md|txt)$/i, "") ?? null;

  const availableCoreFields = [stars, forks, rawDescription, primaryLanguage].filter(
    (value) => value !== null,
  ).length;
  const confidence: Confidence =
    canonical && availableCoreFields >= 3 ? "HIGH" : availableCoreFields >= 2 ? "MEDIUM" : "LOW";

  const result = {
    ...identity,
    description: cleanDescription(rawDescription, identity.fullName),
    homepage: null,
    primaryLanguage,
    license,
    defaultBranch,
    stars,
    forks,
    isFork,
    isArchived,
    observedAt,
    parserVersion: GITHUB_REPOSITORY_PARSER_VERSION,
    confidence,
  } satisfies RepositorySnapshotInput;

  return z
    .object({
      owner: z.string().min(1),
      name: z.string().min(1),
      fullName: z.string().min(3),
      sourceUrl: z.url(),
      description: z.string().max(600).nullable(),
      homepage: z.string().nullable(),
      primaryLanguage: z.string().max(100).nullable(),
      license: z.string().max(100).nullable(),
      defaultBranch: z.string().max(255).nullable(),
      stars: z.number().int().nonnegative().nullable(),
      forks: z.number().int().nonnegative().nullable(),
      isFork: z.boolean().nullable(),
      isArchived: z.boolean(),
      observedAt: z.date(),
      parserVersion: z.string().min(1),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]),
    })
    .parse(result);
}
