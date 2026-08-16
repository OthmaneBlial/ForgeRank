import type { Confidence } from "./confidence";

export type DeveloperSnapshotInput = {
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  sourceUrl: string;
  observedAt: Date;
  parserVersion: string;
  confidence: Confidence;
};

export type DeveloperScoreDimensions = {
  impact: number;
  consistency: number;
  collaboration: number;
  projectQuality: number;
  breadth: number;
  trust: number;
};

export type DeveloperScore = DeveloperScoreDimensions & {
  total: number;
  version: string;
  confidence: Confidence;
  reasons: string[];
};
