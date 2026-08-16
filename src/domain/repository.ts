import type { Confidence } from "./confidence";
import type { RefreshTier } from "./refresh-policy";

export const REPOSITORY_STATES = [
  "ACTIVE",
  "ARCHIVED",
  "UNAVAILABLE",
  "RENAMED",
  "DELETED_OR_PRIVATE_UNKNOWN",
] as const;

export type RepositoryState = (typeof REPOSITORY_STATES)[number];

export const MATURITY_STATES = [
  "NEW",
  "EMERGING",
  "GROWING",
  "ESTABLISHED",
  "MATURE",
  "SLOWING",
  "DORMANT",
  "REVIVED",
] as const;

export type Maturity = (typeof MATURITY_STATES)[number];

export type RepositoryIdentity = {
  owner: string;
  name: string;
  fullName: string;
  sourceUrl: string;
};

export type RepositorySnapshotInput = RepositoryIdentity & {
  description: string | null;
  homepage: string | null;
  primaryLanguage: string | null;
  license: string | null;
  defaultBranch: string | null;
  stars: number | null;
  forks: number | null;
  isFork: boolean | null;
  isArchived: boolean;
  observedAt: Date;
  parserVersion: string;
  confidence: Confidence;
};

export type RepositoryScoreDimensions = {
  impact: number;
  momentum: number;
  health: number;
  community: number;
  engineering: number;
  trust: number;
};

export const REPOSITORY_SCORE_REASON_TONES = ["POSITIVE", "NEUTRAL", "CAUTION", "MISSING"] as const;

export type RepositoryScoreReasonTone = (typeof REPOSITORY_SCORE_REASON_TONES)[number];

export type RepositoryScoreReason = {
  dimension: keyof RepositoryScoreDimensions;
  tone: RepositoryScoreReasonTone;
  summary: string;
  detail: string;
};

export type RepositoryScore = RepositoryScoreDimensions & {
  total: number;
  version: string;
  confidence: Confidence;
  reasons: RepositoryScoreReason[];
};

export type RepositoryListItem = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  license: string | null;
  defaultBranch: string | null;
  isFork: boolean | null;
  stars: number | null;
  forks: number | null;
  score: number | null;
  health: number | null;
  community: number | null;
  engineering: number | null;
  scoreConfidence: Confidence;
  momentum: number | null;
  sevenDayGrowth: number | null;
  discoveredAt: Date;
  observedAt: Date | null;
  repositoryCreatedAt: Date | null;
  lastActivityAt: Date | null;
  maturity: Maturity | null;
  rank: number | null;
  previousRank: number | null;
  state: RepositoryState;
  refreshTier: RefreshTier;
  nextRefreshAt: Date | null;
};
