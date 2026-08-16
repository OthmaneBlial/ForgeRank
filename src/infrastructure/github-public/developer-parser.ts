import { load, type CheerioAPI } from "cheerio";

import type { DeveloperSnapshotInput } from "@/domain/developer";
import { GITHUB_PROFILE_PARSER_VERSION, profileSelectors } from "./selectors";

const attribute = ($: CheerioAPI, selectors: readonly string[], name: string) =>
  selectors.map((selector) => $(selector).first().attr(name)?.trim()).find(Boolean) ?? null;
const text = ($: CheerioAPI, selector: string) =>
  $(selector).first().text().replace(/\s+/g, " ").trim() || null;
const safeAvatarUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "avatars.githubusercontent.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function parseDeveloperHtml(
  html: string,
  identity: { username: string; sourceUrl: string },
  observedAt = new Date(),
): DeveloperSnapshotInput {
  if (html.length < 300 || !/<html/i.test(html))
    throw new Error("The response does not look like a complete profile HTML document.");
  const $ = load(html);
  const canonical = attribute($, profileSelectors.username, "content");
  if (canonical && canonical.toLowerCase() !== identity.username.toLowerCase())
    throw new Error(`Expected ${identity.username}, but the page identifies ${canonical}.`);
  const userType = $(profileSelectors.userType).attr("content")?.trim();
  if (userType && userType.toLowerCase() !== "user")
    throw new Error("ForgeRank developer pages support public user profiles, not organizations.");
  const rawTitle = attribute($, profileSelectors.title, "content") ?? $("title").text().trim();
  const titleMatch = rawTitle?.match(/^(.*?)\s*\(@[^)]+\)/);
  const displayName = text($, profileSelectors.displayName) ?? titleMatch?.[1]?.trim() ?? null;
  const rawDescription =
    text($, profileSelectors.bio) ?? attribute($, profileSelectors.description, "content");
  const bio =
    rawDescription && !/^\S+\s+has\s+\d+\s+repositories/i.test(rawDescription)
      ? rawDescription.slice(0, 500)
      : null;
  const avatarUrl = safeAvatarUrl(attribute($, profileSelectors.avatar, "content"));
  const coreCount = [canonical, displayName, bio, avatarUrl].filter(Boolean).length;
  return {
    ...identity,
    displayName,
    bio,
    location: text($, profileSelectors.location),
    avatarUrl,
    observedAt,
    parserVersion: GITHUB_PROFILE_PARSER_VERSION,
    confidence: canonical && coreCount >= 3 ? "HIGH" : coreCount >= 2 ? "MEDIUM" : "LOW",
  };
}
