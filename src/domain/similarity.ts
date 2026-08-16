export const REPOSITORY_SIMILARITY_VERSION = "repository-similarity-v2";

export const REPOSITORY_SIMILARITY_WEIGHTS = Object.freeze({
  language: 25,
  topics: 25,
  technologies: 20,
  descriptionKeywords: 15,
  collections: 10,
  maturity: 5,
});

export const REPOSITORY_SIMILARITY_MINIMUM_SCORE = 15;

const MAX_DESCRIPTION_KEYWORDS = 32;
const MAX_EVIDENCE_VALUES = 5;
const DESCRIPTION_STOP_WORDS = new Set([
  "about",
  "also",
  "and",
  "are",
  "built",
  "can",
  "for",
  "from",
  "into",
  "its",
  "open",
  "project",
  "source",
  "that",
  "the",
  "their",
  "this",
  "tool",
  "using",
  "with",
  "your",
]);

export type RepositorySimilaritySignals = {
  language: string | null;
  candidateLanguage: string | null;
  topics: string[];
  candidateTopics: string[];
  technologies: string[];
  candidateTechnologies: string[];
  description: string | null;
  candidateDescription: string | null;
  collections: string[];
  candidateCollections: string[];
  maturity: string | null;
  candidateMaturity: string | null;
};

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("en-US");
const normalizedSet = (values: string[]) => new Set(values.map(normalize));
const intersection = (left: Set<string>, right: Set<string>) =>
  [...left].filter((value) => right.has(value)).sort((a, b) => a.localeCompare(b));
const sharedValues = (left: string[], right: string[]) => {
  const rightValues = normalizedSet(right);
  const leftLabels = new Map(left.map((value) => [normalize(value), value]));
  return [...leftLabels]
    .filter(([normalized]) => rightValues.has(normalized))
    .map(([, label]) => label)
    .sort((a, b) => a.localeCompare(b));
};

const jaccard = (left: string[], right: string[]) => {
  if (left.length === 0 || right.length === 0) return 0;
  const a = normalizedSet(left);
  const b = normalizedSet(right);
  return intersection(a, b).length / new Set([...a, ...b]).size;
};

export function extractDescriptionKeywords(description: string | null): string[] {
  if (!description) return [];
  const words = normalize(description).match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) ?? [];
  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const normalized = word.replace(/^[.-]+|[.-]+$/g, "");
    if (normalized.length < 3 || DESCRIPTION_STOP_WORDS.has(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    keywords.push(normalized);
    if (keywords.length === MAX_DESCRIPTION_KEYWORDS) break;
  }
  return keywords;
}

const evidenceValues = (values: string[]) => values.slice(0, MAX_EVIDENCE_VALUES).join(", ");

export function calculateRepositorySimilarity(signals: RepositorySimilaritySignals) {
  const sameLanguage = Boolean(
    signals.language &&
    signals.candidateLanguage &&
    normalize(signals.language) === normalize(signals.candidateLanguage),
  );
  const sharedTopics = sharedValues(signals.topics, signals.candidateTopics);
  const sharedTechnologies = sharedValues(signals.technologies, signals.candidateTechnologies);
  const descriptionKeywords = extractDescriptionKeywords(signals.description);
  const candidateDescriptionKeywords = extractDescriptionKeywords(signals.candidateDescription);
  const sharedDescriptionKeywords = sharedValues(descriptionKeywords, candidateDescriptionKeywords);
  const sharedCollections = sharedValues(signals.collections, signals.candidateCollections);
  const sameMaturity = Boolean(
    signals.maturity && signals.candidateMaturity && signals.maturity === signals.candidateMaturity,
  );
  const dimensions = {
    language: sameLanguage ? REPOSITORY_SIMILARITY_WEIGHTS.language : 0,
    topics: Math.round(
      jaccard(signals.topics, signals.candidateTopics) * REPOSITORY_SIMILARITY_WEIGHTS.topics,
    ),
    technologies: Math.round(
      jaccard(signals.technologies, signals.candidateTechnologies) *
        REPOSITORY_SIMILARITY_WEIGHTS.technologies,
    ),
    descriptionKeywords: Math.round(
      jaccard(descriptionKeywords, candidateDescriptionKeywords) *
        REPOSITORY_SIMILARITY_WEIGHTS.descriptionKeywords,
    ),
    collections: Math.round(
      jaccard(signals.collections, signals.candidateCollections) *
        REPOSITORY_SIMILARITY_WEIGHTS.collections,
    ),
    maturity: sameMaturity ? REPOSITORY_SIMILARITY_WEIGHTS.maturity : 0,
  };
  const evidence = [
    sameLanguage ? `Same primary language: ${signals.language}` : null,
    sharedTopics.length > 0 ? `Shared topics: ${evidenceValues(sharedTopics)}` : null,
    sharedTechnologies.length > 0
      ? `Shared technology: ${evidenceValues(sharedTechnologies)}`
      : null,
    sharedDescriptionKeywords.length > 0
      ? `Shared description keywords: ${evidenceValues(sharedDescriptionKeywords)}`
      : null,
    sharedCollections.length > 0
      ? `Shared collections: ${evidenceValues(sharedCollections)}`
      : null,
    sameMaturity ? `Same lifecycle: ${signals.maturity?.toLowerCase()}` : null,
  ].filter((value): value is string => value !== null);
  return {
    version: REPOSITORY_SIMILARITY_VERSION,
    score: Object.values(dimensions).reduce((sum, value) => sum + value, 0),
    dimensions,
    evidence,
  };
}
