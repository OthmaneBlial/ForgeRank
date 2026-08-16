import { describe, expect, it } from "vitest";

import {
  calculateRepositorySimilarity,
  extractDescriptionKeywords,
  REPOSITORY_SIMILARITY_VERSION,
  REPOSITORY_SIMILARITY_WEIGHTS,
} from "./similarity";

describe("deterministic repository similarity", () => {
  it("scores every specified evidence dimension without external semantics", () => {
    const result = calculateRepositorySimilarity({
      language: "TypeScript",
      candidateLanguage: "TypeScript",
      topics: ["web-frameworks", "frontend"],
      candidateTopics: ["frontend", "tooling"],
      technologies: ["pnpm", "vitest"],
      candidateTechnologies: ["pnpm", "turbo"],
      description: "A fast frontend compiler for reactive web interfaces.",
      candidateDescription: "Reactive frontend toolkit for accessible web interfaces.",
      collections: ["Frontend Foundations", "Compiler Toolchains"],
      candidateCollections: ["Frontend Foundations", "Developer Tooling"],
      maturity: "GROWING",
      candidateMaturity: "GROWING",
    });

    expect(result).toMatchObject({
      version: REPOSITORY_SIMILARITY_VERSION,
      dimensions: {
        language: 25,
        topics: 8,
        technologies: 7,
        descriptionKeywords: 8,
        collections: 3,
        maturity: 5,
      },
      score: 56,
    });
    expect(result.evidence).toEqual([
      "Same primary language: TypeScript",
      "Shared topics: frontend",
      "Shared technology: pnpm",
      "Shared description keywords: frontend, interfaces, reactive, web",
      "Shared collections: Frontend Foundations",
      "Same lifecycle: growing",
    ]);
  });

  it("extracts a bounded, normalized, unique keyword set", () => {
    expect(
      extractDescriptionKeywords("The FAST fast C++ toolkit—with APIs for your apps."),
    ).toEqual(["fast", "c++", "toolkit", "apis", "apps"]);
    expect(extractDescriptionKeywords(null)).toEqual([]);
  });

  it("keeps the public formula on a fixed 100-point scale", () => {
    expect(
      Object.values(REPOSITORY_SIMILARITY_WEIGHTS).reduce((sum, value) => sum + value, 0),
    ).toBe(100);
  });

  it("does not turn missing fields into a match", () => {
    expect(
      calculateRepositorySimilarity({
        language: null,
        candidateLanguage: null,
        topics: [],
        candidateTopics: [],
        technologies: [],
        candidateTechnologies: [],
        description: null,
        candidateDescription: null,
        collections: [],
        candidateCollections: [],
        maturity: null,
        candidateMaturity: null,
      }),
    ).toMatchObject({ score: 0, evidence: [] });
  });
});
