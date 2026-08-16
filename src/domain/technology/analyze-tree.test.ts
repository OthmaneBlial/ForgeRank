import { describe, expect, it } from "vitest";

import { detectPrimaryLanguage, detectQualitySignals, detectTechnologies } from "./analyze-tree";

describe("repository tree analysis", () => {
  const paths = [
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "package.json",
    "pnpm-lock.yaml",
    "turbo.json",
    "Dockerfile",
    ".github/workflows/ci.yml",
    "src/index.ts",
    "src/app.tsx",
    "src/legacy.js",
    "tests/app.test.ts",
    "node_modules/ignored/index.js",
    "dist/generated.js",
  ];

  it("detects a primary language without counting vendored output", () => {
    const result = detectPrimaryLanguage(paths);
    expect(result.language).toBe("TypeScript");
    expect(result.counts.JavaScript).toBe(1);
    expect(result.counts.TypeScript).toBe(3);
  });

  it("detects technologies from files and bounded manifest evidence", () => {
    const technologies = detectTechnologies(paths, {
      "package.json": JSON.stringify({
        dependencies: { react: "19.0.0", next: "16.0.0" },
        devDependencies: { vitest: "4.0.0", typescript: "6.0.0" },
      }),
    });
    expect(technologies.map((technology) => technology.name)).toEqual(
      expect.arrayContaining([
        "pnpm",
        "Docker",
        "GitHub Actions",
        "Turborepo",
        "React",
        "Next.js",
        "Vitest",
        "TypeScript",
      ]),
    );
  });

  it("reports deterministic quality signals without declaring quality", () => {
    expect(detectQualitySignals(paths)).toMatchObject({
      readme: true,
      license: true,
      contributing: true,
      security: true,
      tests: true,
      ci: true,
      docker: true,
    });
  });
});
