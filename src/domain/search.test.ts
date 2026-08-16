import { describe, expect, it } from "vitest";

import { trigramSimilarity } from "./search";

describe("trigramSimilarity", () => {
  it("ranks exact and near matches above unrelated terms", () => {
    expect(trigramSimilarity("TypeScript", "typescript")).toBe(1);
    expect(trigramSimilarity("TypeScript", "typescrpt")).toBeGreaterThan(0.6);
    expect(trigramSimilarity("TypeScript", "database")).toBeLessThan(0.2);
  });

  it("normalizes case and repeated whitespace", () => {
    expect(trigramSimilarity("AI Agents", "ai   agents")).toBe(1);
  });
});
