import { describe, expect, it } from "vitest";

import { analyzeReadme, README_ANALYSIS_LIMITS, selectReadmePath } from "./readme-analysis";

describe("README structural analysis", () => {
  it("selects the shallowest canonical README deterministically", () => {
    expect(
      selectReadmePath(["packages/web/README.md", "README.txt", "README.md", "docs/readme.md"]),
    ).toBe("README.md");
    expect(selectReadmePath(["docs/README.adoc", "packages/api/README.md"])).toBe(
      "docs/README.adoc",
    );
    expect(selectReadmePath(["docs/index.md"])).toBeNull();
  });

  it("extracts bounded factual structure without a quality judgment", () => {
    const content = [
      "# Example",
      "[![Build status](https://img.shields.io/badge/build-passing.svg)](https://ci.test)",
      "![Screenshot](./screen.png)",
      "## Installation",
      "Use the package manager.",
      "## Documentation",
      "Read the [developer guide](https://docs.example.test/guide).",
      "See also <https://example.test/wiki>.",
    ].join("\n");
    expect(
      analyzeReadme({ path: "README.md", sizeBytes: Buffer.byteLength(content), content }),
    ).toEqual({
      path: "README.md",
      sizeBytes: Buffer.byteLength(content),
      lineCount: 8,
      sectionCount: 3,
      sections: ["Example", "Installation", "Documentation"],
      badgeCount: 1,
      hasInstallationSection: true,
      documentationLinkCount: 2,
      contentInspected: true,
      confidence: "HIGH",
      version: "readme-structure-v1",
    });
  });

  it("retains blob size while withholding structure when bounded content is unavailable", () => {
    expect(analyzeReadme({ path: "README.md", sizeBytes: 900_000, content: null })).toMatchObject({
      sizeBytes: 900_000,
      lineCount: null,
      sectionCount: null,
      sections: [],
      badgeCount: null,
      hasInstallationSection: null,
      documentationLinkCount: null,
      contentInspected: false,
      confidence: "LOW",
    });
  });

  it("sanitizes and caps section titles exposed to the product UI", () => {
    const headings = Array.from(
      { length: README_ANALYSIS_LIMITS.maximumExposedSections + 4 },
      (_, index) => `## **[Section ${index}](https://example.test/${index})**`,
    ).join("\n");
    const result = analyzeReadme({
      path: "README.md",
      sizeBytes: Buffer.byteLength(headings),
      content: headings,
    });
    expect(result.sectionCount).toBe(24);
    expect(result.sections).toHaveLength(README_ANALYSIS_LIMITS.maximumExposedSections);
    expect(result.sections[0]).toBe("Section 0");
  });
});
