export type TechnologyDetection = {
  name: string;
  category: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
};

export type RepositoryFileContext = {
  paths: readonly string[];
  pathSet: ReadonlySet<string>;
  manifests: Readonly<Record<string, string>>;
};

export interface TechnologyDetector {
  detect(context: RepositoryFileContext): TechnologyDetection[];
}

export type RepositoryQualitySignals = {
  readme: boolean;
  license: boolean;
  contributing: boolean;
  codeOfConduct: boolean;
  security: boolean;
  tests: boolean;
  ci: boolean;
  docker: boolean;
  releaseAutomation: boolean;
  dependencyManagement: boolean;
  documentation: boolean;
};

export const TECHNOLOGY_DETECTION_VERSION = "technology-detection-v2";
export const REPOSITORY_QUALITY_SIGNAL_VERSION = "repository-quality-signals-v2";
export const TECHNOLOGY_MANIFEST_CANDIDATES = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
  "pubspec.yaml",
] as const;

const extensions: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".swift": "Swift",
  ".c": "C",
  ".h": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".cxx": "C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".php": "PHP",
  ".rb": "Ruby",
  ".dart": "Dart",
  ".sh": "Shell",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".scala": "Scala",
  ".lua": "Lua",
};

const ignoredSegments = new Set([
  "node_modules",
  "vendor",
  "dist",
  "build",
  ".next",
  "target",
  "third_party",
  "third-party",
  "fixtures",
  "snapshots",
]);

export function detectPrimaryLanguage(paths: string[]): {
  language: string | null;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  for (const path of paths) {
    const parts = path.toLowerCase().split("/");
    if (parts.some((part) => ignoredSegments.has(part))) continue;
    if (path.endsWith(".d.ts") || /(?:^|\/)generated(?:\/|$)/i.test(path)) continue;
    const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
    const language = extensions[extension];
    if (language) counts[language] = (counts[language] ?? 0) + 1;
  }
  const [winner] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { language: winner?.[0] ?? null, counts };
}

export function detectTechnologies(
  paths: string[],
  manifests: Record<string, string>,
): TechnologyDetection[] {
  const normalizedPaths = paths
    .map(normalizeRepositoryPath)
    .filter((repositoryPath) => !isIgnoredRepositoryPath(repositoryPath));
  const context: RepositoryFileContext = {
    paths: normalizedPaths,
    pathSet: new Set(normalizedPaths),
    manifests: Object.fromEntries(
      Object.entries(manifests).map(([manifestPath, content]) => [
        normalizeRepositoryPath(manifestPath),
        content,
      ]),
    ),
  };
  const detections = new Map<string, TechnologyDetection>();
  for (const detector of TECHNOLOGY_DETECTORS) {
    for (const detection of detector.detect(context)) {
      if (!detections.has(detection.name)) detections.set(detection.name, detection);
    }
  }
  return [...detections.values()];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function technology(
  name: string,
  category: string,
  confidence: TechnologyDetection["confidence"],
  evidence: string,
): TechnologyDetection {
  return { name, category, confidence, evidence };
}

function normalizeRepositoryPath(repositoryPath: string): string {
  return repositoryPath
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .toLowerCase();
}

function isIgnoredRepositoryPath(repositoryPath: string): boolean {
  return repositoryPath.split("/").some((segment) => ignoredSegments.has(segment));
}

function findFile(context: RepositoryFileContext, fileName: string): string | null {
  const normalized = fileName.toLowerCase();
  return (
    context.paths.find((repositoryPath) => {
      const baseName = repositoryPath.split("/").at(-1) ?? repositoryPath;
      return baseName === normalized;
    }) ?? null
  );
}

function manifestContent(context: RepositoryFileContext, manifestPath: string): string | null {
  return context.manifests[manifestPath.toLowerCase()] ?? null;
}

const javascriptDetector: TechnologyDetector = {
  detect(context) {
    const detections: TechnologyDetection[] = [];
    if (findFile(context, "package.json"))
      detections.push(technology("Node.js package", "runtime", "HIGH", "package.json"));
    if (findFile(context, "pnpm-lock.yaml"))
      detections.push(technology("pnpm", "package-manager", "HIGH", "pnpm-lock.yaml"));
    if (findFile(context, "yarn.lock"))
      detections.push(technology("Yarn", "package-manager", "HIGH", "yarn.lock"));
    if (findFile(context, "bun.lock") || findFile(context, "bun.lockb"))
      detections.push(technology("Bun", "package-manager", "HIGH", "Bun lockfile"));

    const packageJson = manifestContent(context, "package.json");
    if (packageJson) {
      try {
        const manifest = JSON.parse(packageJson) as Record<string, unknown>;
        const dependencies = {
          ...asRecord(manifest.dependencies),
          ...asRecord(manifest.devDependencies),
        };
        if ("react" in dependencies)
          detections.push(technology("React", "framework", "HIGH", "package.json dependency"));
        if ("next" in dependencies)
          detections.push(technology("Next.js", "framework", "HIGH", "package.json dependency"));
        if ("vue" in dependencies)
          detections.push(technology("Vue", "framework", "HIGH", "package.json dependency"));
        if ("svelte" in dependencies)
          detections.push(technology("Svelte", "framework", "HIGH", "package.json dependency"));
        if ("vitest" in dependencies)
          detections.push(technology("Vitest", "testing", "HIGH", "package.json dependency"));
        if ("@playwright/test" in dependencies || "playwright" in dependencies)
          detections.push(technology("Playwright", "testing", "HIGH", "package.json dependency"));
        if ("typescript" in dependencies)
          detections.push(
            technology("TypeScript", "language-tooling", "HIGH", "package.json dependency"),
          );
      } catch {
        detections.push(
          technology("package.json", "manifest", "LOW", "Manifest was present but unparseable"),
        );
      }
    }
    return detections;
  },
};

const compiledEcosystemDetector: TechnologyDetector = {
  detect(context) {
    const detections: TechnologyDetection[] = [];
    if (findFile(context, "Cargo.toml"))
      detections.push(technology("Cargo", "package-manager", "HIGH", "Cargo.toml"));
    if (findFile(context, "go.mod"))
      detections.push(technology("Go modules", "package-manager", "HIGH", "go.mod"));
    if (findFile(context, "pom.xml"))
      detections.push(technology("Maven", "build", "HIGH", "pom.xml"));
    if (findFile(context, "build.gradle") || findFile(context, "build.gradle.kts"))
      detections.push(technology("Gradle", "build", "HIGH", "Gradle build file"));
    return detections;
  },
};

const languageEcosystemDetector: TechnologyDetector = {
  detect(context) {
    const detections: TechnologyDetection[] = [];
    const pyproject = findFile(context, "pyproject.toml");
    const requirements = context.paths.find((repositoryPath) =>
      /(^|\/)requirements(?:[-_.][^/]*)?\.txt$/.test(repositoryPath),
    );
    if (pyproject || requirements)
      detections.push(
        technology(
          "Python project",
          "runtime",
          "HIGH",
          pyproject ? "pyproject.toml" : "requirements.txt",
        ),
      );
    if (requirements)
      detections.push(technology("pip", "package-manager", "HIGH", "requirements.txt"));

    if (findFile(context, "Gemfile")) {
      detections.push(technology("Ruby project", "runtime", "HIGH", "Gemfile"));
      detections.push(technology("Bundler", "package-manager", "HIGH", "Gemfile"));
    }
    if (findFile(context, "composer.json")) {
      detections.push(technology("PHP project", "runtime", "HIGH", "composer.json"));
      detections.push(technology("Composer", "package-manager", "HIGH", "composer.json"));
    }
    if (findFile(context, "pubspec.yaml")) {
      detections.push(technology("Dart project", "runtime", "HIGH", "pubspec.yaml"));
      detections.push(technology("Dart pub", "package-manager", "HIGH", "pubspec.yaml"));
      const pubspec = manifestContent(context, "pubspec.yaml");
      if (pubspec && /(^|\n)\s*sdk:\s*flutter\s*(?:$|\n)/m.test(pubspec))
        detections.push(technology("Flutter", "framework", "HIGH", "pubspec.yaml Flutter SDK"));
    }
    return detections;
  },
};

const infrastructureDetector: TechnologyDetector = {
  detect(context) {
    const detections: TechnologyDetection[] = [];
    if (
      context.paths.some((repositoryPath) => /(^|\/)dockerfile(?:\.[^/]*)?$/.test(repositoryPath))
    )
      detections.push(technology("Docker", "infrastructure", "HIGH", "Dockerfile"));
    if (
      context.paths.some((repositoryPath) =>
        /(^|\/)(?:docker-)?compose(?:\.[^/]*)?\.ya?ml$/.test(repositoryPath),
      )
    )
      detections.push(
        technology("Docker Compose", "infrastructure", "HIGH", "Docker Compose file"),
      );
    if (
      context.paths.some(
        (repositoryPath) =>
          repositoryPath.startsWith(".github/workflows/") &&
          (repositoryPath.endsWith(".yml") || repositoryPath.endsWith(".yaml")),
      )
    )
      detections.push(technology("GitHub Actions", "ci", "HIGH", ".github/workflows"));
    if (findFile(context, "turbo.json"))
      detections.push(technology("Turborepo", "monorepo", "HIGH", "turbo.json"));
    return detections;
  },
};

export const TECHNOLOGY_DETECTORS: readonly TechnologyDetector[] = Object.freeze([
  javascriptDetector,
  compiledEcosystemDetector,
  languageEcosystemDetector,
  infrastructureDetector,
]);

const dependencyFileNames = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "requirements.txt",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "gradle.lockfile",
  "gemfile",
  "gemfile.lock",
  "composer.json",
  "composer.lock",
  "pubspec.yaml",
  "pubspec.lock",
]);

export function detectQualitySignals(paths: string[]): RepositoryQualitySignals {
  const lower = paths
    .map(normalizeRepositoryPath)
    .filter((repositoryPath) => !isIgnoredRepositoryPath(repositoryPath));
  const baseNames = new Set(lower.map((path) => path.split("/").at(-1) ?? path));
  return {
    readme: [...baseNames].some((name) => /^readme(?:\.|$)/.test(name)),
    license: [...baseNames].some((name) => /^(license|copying)(?:\.|$)/.test(name)),
    contributing: [...baseNames].some((name) => /^contributing(?:\.|$)/.test(name)),
    codeOfConduct: [...baseNames].some((name) => /^code[-_]?of[-_]?conduct(?:\.|$)/.test(name)),
    security: [...baseNames].some((name) => /^security(?:\.|$)/.test(name)),
    tests: lower.some(
      (path) =>
        /(^|\/)(test|tests|spec|specs)(\/|$)/.test(path) || /\.(test|spec)\.[^.]+$/.test(path),
    ),
    ci: lower.some(
      (path) =>
        path.startsWith(".github/workflows/") ||
        path === ".gitlab-ci.yml" ||
        path === ".travis.yml" ||
        path === "azure-pipelines.yml" ||
        path === "bitbucket-pipelines.yml" ||
        path === "circle.yml" ||
        path.startsWith(".circleci/"),
    ),
    docker: lower.some(
      (path) =>
        /(^|\/)dockerfile(?:\.[^/]*)?$/.test(path) ||
        /(^|\/)(?:docker-)?compose(?:\.[^/]*)?\.ya?ml$/.test(path),
    ),
    releaseAutomation: lower.some(
      (path) =>
        /^\.github\/workflows\/[^/]*(?:release|publish)[^/]*\.ya?ml$/.test(path) ||
        path === ".changeset/config.json" ||
        /^\.releaserc(?:\.[^/]+)?$/.test(path) ||
        /^release\.config\.[^/]+$/.test(path) ||
        path === "release-please-config.json" ||
        /(^|\/)\.?(?:go)?releaser\.ya?ml$/.test(path) ||
        path === "cargo-release.toml",
    ),
    dependencyManagement:
      [...baseNames].some((name) => dependencyFileNames.has(name)) ||
      lower.some((path) => /(^|\/)requirements(?:[-_.][^/]*)?\.txt$/.test(path)),
    documentation: lower.some(
      (path) =>
        /^(?:docs|documentation)\/.+/.test(path) ||
        /^(?:mkdocs\.ya?ml|book\.toml|\.readthedocs\.ya?ml)$/.test(path) ||
        /^docusaurus\.config\.[^/]+$/.test(path),
    ),
  };
}
