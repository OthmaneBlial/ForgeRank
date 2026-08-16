export type RepositorySimilaritySignals = {
  language: string | null;
  candidateLanguage: string | null;
  topics: string[];
  candidateTopics: string[];
  technologies: string[];
  candidateTechnologies: string[];
  maturity: string | null;
  candidateMaturity: string | null;
};

const intersection = (left: Set<string>, right: Set<string>) =>
  [...left].filter((value) => right.has(value));
const jaccard = (left: string[], right: string[]) => {
  if (left.length === 0 || right.length === 0) return 0;
  const a = new Set(left.map((value) => value.toLowerCase()));
  const b = new Set(right.map((value) => value.toLowerCase()));
  return intersection(a, b).length / new Set([...a, ...b]).size;
};

export function calculateRepositorySimilarity(signals: RepositorySimilaritySignals) {
  const sameLanguage = Boolean(
    signals.language &&
    signals.candidateLanguage &&
    signals.language.toLowerCase() === signals.candidateLanguage.toLowerCase(),
  );
  const sharedTopics = intersection(
    new Set(signals.topics.map((value) => value.toLowerCase())),
    new Set(signals.candidateTopics.map((value) => value.toLowerCase())),
  );
  const sharedTechnologies = intersection(
    new Set(signals.technologies.map((value) => value.toLowerCase())),
    new Set(signals.candidateTechnologies.map((value) => value.toLowerCase())),
  );
  const sameMaturity = Boolean(
    signals.maturity && signals.candidateMaturity && signals.maturity === signals.candidateMaturity,
  );
  const dimensions = {
    language: sameLanguage ? 35 : 0,
    topics: Math.round(jaccard(signals.topics, signals.candidateTopics) * 30),
    technologies: Math.round(jaccard(signals.technologies, signals.candidateTechnologies) * 25),
    maturity: sameMaturity ? 10 : 0,
  };
  const evidence = [
    sameLanguage ? `Same primary language: ${signals.language}` : null,
    sharedTopics.length > 0 ? `Shared topics: ${sharedTopics.join(", ")}` : null,
    sharedTechnologies.length > 0 ? `Shared technology: ${sharedTechnologies.join(", ")}` : null,
    sameMaturity ? `Same lifecycle: ${signals.maturity?.toLowerCase()}` : null,
  ].filter((value): value is string => value !== null);
  return {
    score: Object.values(dimensions).reduce((sum, value) => sum + value, 0),
    dimensions,
    evidence,
  };
}
