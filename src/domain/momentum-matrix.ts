import type { Confidence } from "./confidence";
import type { RepositoryListItem } from "./repository";

export const MOMENTUM_MATRIX_AGE_FILTERS = [
  "all",
  "new",
  "under-1",
  "1-3",
  "3-5",
  "5-plus",
] as const;

export type MomentumMatrixAgeFilter = (typeof MOMENTUM_MATRIX_AGE_FILTERS)[number];

export type MomentumMatrixFilters = {
  language?: string;
  topic?: string;
  age: MomentumMatrixAgeFilter;
  minimumStars: number;
};

export type MomentumMatrixPoint = {
  repository: RepositoryListItem;
  growth30d: number | null;
  growthConfidence: Confidence;
  historySpanDays: number;
  ageDays: number | null;
  topicSlugs: string[];
};

export function filterMomentumMatrixPoints(
  points: MomentumMatrixPoint[],
  filters: MomentumMatrixFilters,
): MomentumMatrixPoint[] {
  const language = filters.language?.trim().toLocaleLowerCase();
  const topic = filters.topic?.trim().toLocaleLowerCase();
  const minimumStars = Math.max(0, filters.minimumStars);
  return points
    .filter((point) => {
      if (point.repository.stars === null || point.repository.momentum === null) return false;
      if (language && point.repository.primaryLanguage?.toLocaleLowerCase() !== language)
        return false;
      if (topic && !point.topicSlugs.some((slug) => slug.toLocaleLowerCase() === topic))
        return false;
      if (point.repository.stars < minimumStars) return false;
      return matchesAge(point.ageDays, filters.age);
    })
    .toSorted(
      (left, right) =>
        (right.repository.momentum ?? -1) - (left.repository.momentum ?? -1) ||
        (right.repository.score ?? -1) - (left.repository.score ?? -1) ||
        left.repository.fullName.localeCompare(right.repository.fullName),
    );
}

function matchesAge(ageDays: number | null, filter: MomentumMatrixAgeFilter): boolean {
  if (filter === "all") return true;
  if (ageDays === null) return false;
  if (filter === "new") return ageDays < 90;
  if (filter === "under-1") return ageDays < 365;
  if (filter === "1-3") return ageDays >= 365 && ageDays < 3 * 365;
  if (filter === "3-5") return ageDays >= 3 * 365 && ageDays < 5 * 365;
  return ageDays >= 5 * 365;
}
