import { describe, expect, it } from "vitest";

import { calculateRepositorySimilarity } from "./similarity";

describe("deterministic repository similarity", () => {
  it("rewards only shared observed evidence", () => {
    const result = calculateRepositorySimilarity({
      language: "TypeScript",
      candidateLanguage: "TypeScript",
      topics: ["web-frameworks", "frontend"],
      candidateTopics: ["frontend", "tooling"],
      technologies: ["pnpm", "vitest"],
      candidateTechnologies: ["pnpm", "turbo"],
      maturity: "GROWING",
      candidateMaturity: "GROWING",
    });
    expect(result.score).toBe(63);
    expect(result.evidence).toContain("Same primary language: TypeScript");
    expect(result.evidence).toContain("Shared topics: frontend");
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
        maturity: null,
        candidateMaturity: null,
      }),
    ).toMatchObject({ score: 0, evidence: [] });
  });
});
