export const README_ANALYSIS_VERSION = "readme-structure-v1";
export const README_ANALYSIS_LIMITS = {
  maximumContentBytes: 512 * 1024,
  maximumExposedSections: 20,
  maximumSectionTitleLength: 80,
} as const;

export type ReadmeAnalysis = {
  path: string;
  sizeBytes: number;
  lineCount: number | null;
  sectionCount: number | null;
  sections: string[];
  badgeCount: number | null;
  hasInstallationSection: boolean | null;
  documentationLinkCount: number | null;
  contentInspected: boolean;
  confidence: "HIGH" | "LOW";
  version: typeof README_ANALYSIS_VERSION;
};

export function selectReadmePath(paths: string[]): string | null {
  const candidates = paths.filter((candidate) => {
    const baseName = candidate.split("/").at(-1) ?? candidate;
    return /^readme(?:\.[a-z0-9_-]+)?$/i.test(baseName);
  });
  return (
    candidates.toSorted((left, right) => {
      const depth = pathDepth(left) - pathDepth(right);
      if (depth !== 0) return depth;
      const preferred = readmePreference(left) - readmePreference(right);
      return preferred || left.localeCompare(right);
    })[0] ?? null
  );
}

export function analyzeReadme(input: {
  path: string;
  sizeBytes: number;
  content: string | null;
}): ReadmeAnalysis {
  const sizeBytes = Math.max(0, Math.floor(input.sizeBytes));
  if (input.content === null) {
    return {
      path: input.path,
      sizeBytes,
      lineCount: null,
      sectionCount: null,
      sections: [],
      badgeCount: null,
      hasInstallationSection: null,
      documentationLinkCount: null,
      contentInspected: false,
      confidence: "LOW",
      version: README_ANALYSIS_VERSION,
    };
  }

  const headings = input.content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1] ?? null)
    .filter((heading): heading is string => heading !== null)
    .map(cleanHeading)
    .filter(Boolean);

  return {
    path: input.path,
    sizeBytes,
    lineCount: input.content.length === 0 ? 0 : input.content.split(/\r?\n/).length,
    sectionCount: headings.length,
    sections: headings.slice(0, README_ANALYSIS_LIMITS.maximumExposedSections),
    badgeCount: countBadges(input.content),
    hasInstallationSection: headings.some((heading) =>
      /^(installation|installing|install|setup|getting started|quick ?start)(?:\b|$)/i.test(
        heading,
      ),
    ),
    documentationLinkCount: countDocumentationLinks(input.content),
    contentInspected: true,
    confidence: "HIGH",
    version: README_ANALYSIS_VERSION,
  };
}

function pathDepth(value: string): number {
  return value.split("/").length - 1;
}

function readmePreference(value: string): number {
  const baseName = value.split("/").at(-1)?.toLowerCase();
  if (baseName === "readme.md") return 0;
  if (baseName === "readme") return 1;
  return 2;
}

function cleanHeading(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, README_ANALYSIS_LIMITS.maximumSectionTitleLength);
}

function countBadges(content: string): number {
  let count = 0;
  for (const match of content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const evidence = `${match[1] ?? ""} ${match[2] ?? ""}`;
    if (
      /(?:badge|badge\.svg|shield|shields\.io|status|coverage|codecov|coveralls|travis-ci)/i.test(
        evidence,
      )
    )
      count += 1;
  }
  for (const match of content.matchAll(/!\[([^\]]+)\]\[[^\]]+\]/g)) {
    if (/(?:badge|build|status|coverage)/i.test(match[1] ?? "")) count += 1;
  }
  return count;
}

function countDocumentationLinks(content: string): number {
  const links = new Set<string>();
  for (const match of content.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const label = match[1] ?? "";
    const target = match[2] ?? "";
    if (/(?:docs?|documentation|wiki|guide|manual|reference)/i.test(`${label} ${target}`))
      links.add(target.toLowerCase());
  }
  for (const match of content.matchAll(/<(https?:\/\/[^>]+)>/g)) {
    const target = match[1] ?? "";
    if (/(?:docs?|documentation|wiki|guide|manual|reference)/i.test(target))
      links.add(target.toLowerCase());
  }
  return links.size;
}
