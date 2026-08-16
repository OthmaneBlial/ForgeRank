import { describe, expect, it } from "vitest";

import {
  detectPrimaryLanguage,
  detectQualitySignals,
  detectTechnologies,
  TECHNOLOGY_DETECTORS,
  TECHNOLOGY_MANIFEST_CANDIDATES,
} from "./analyze-tree";

describe("repository tree analysis", () => {
  const paths = [
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "CODE-OF-CONDUCT.md",
    "SECURITY.md",
    "package.json",
    "pnpm-lock.yaml",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle.kts",
    "Gemfile",
    "composer.json",
    "pubspec.yaml",
    "turbo.json",
    "Dockerfile",
    "docker-compose.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/release.yml",
    "docs/guide.md",
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
      "pubspec.yaml": "dependencies:\n  flutter:\n    sdk: flutter\n",
    });
    expect(technologies.map((technology) => technology.name)).toEqual(
      expect.arrayContaining([
        "pnpm",
        "Python project",
        "pip",
        "Cargo",
        "Go modules",
        "Maven",
        "Gradle",
        "Ruby project",
        "Bundler",
        "PHP project",
        "Composer",
        "Dart project",
        "Dart pub",
        "Flutter",
        "Docker",
        "Docker Compose",
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
      codeOfConduct: true,
      security: true,
      tests: true,
      ci: true,
      docker: true,
      releaseAutomation: true,
      dependencyManagement: true,
      documentation: true,
    });
  });

  it("keeps documentation and release evidence distinct from generic files and CI", () => {
    expect(
      detectQualitySignals([
        "README.md",
        ".github/workflows/ci.yml",
        "src/index.ts",
        "fixtures/release.config.js",
      ]),
    ).toMatchObject({
      readme: true,
      ci: true,
      releaseAutomation: false,
      dependencyManagement: false,
      documentation: false,
    });
  });

  it("publishes a bounded pluggable detector registry for every specified manifest", () => {
    expect(TECHNOLOGY_DETECTORS.length).toBeGreaterThanOrEqual(4);
    expect(TECHNOLOGY_MANIFEST_CANDIDATES).toEqual(
      expect.arrayContaining([
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "Gemfile",
        "composer.json",
        "pubspec.yaml",
      ]),
    );
  });
});
