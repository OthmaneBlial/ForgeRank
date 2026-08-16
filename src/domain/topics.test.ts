import { describe, expect, it } from "vitest";

import { classifyTopics } from "./topics";

describe("topic classification", () => {
  it("assigns multiple evidence-backed topics", () => {
    const result = classifyTopics({
      description: "A frontend component library and web application framework.",
      technologies: ["React", "Next.js", "Vitest"],
    });
    expect(result.map((topic) => topic.slug)).toEqual(
      expect.arrayContaining(["frontend", "web-frameworks", "testing"]),
    );
  });

  it("does not classify from one weak incidental word", () => {
    expect(classifyTopics({ description: "A small server helper.", technologies: [] })).toEqual([]);
  });

  it("uses detected technology as deterministic evidence", () => {
    const result = classifyTopics({ description: null, technologies: ["Playwright"] });
    expect(result).toEqual([
      { slug: "testing", confidence: "MEDIUM", evidence: "Playwright detected" },
    ]);
  });
});
