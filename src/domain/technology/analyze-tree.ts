export type TechnologyDetection = {
  name: string;
  category: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
};

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
  const normalized = new Set(paths.map((path) => path.toLowerCase()));
  const detections: TechnologyDetection[] = [];
  const add = (
    name: string,
    category: string,
    confidence: TechnologyDetection["confidence"],
    evidence: string,
  ) => {
    if (!detections.some((detection) => detection.name === name))
      detections.push({ name, category, confidence, evidence });
  };

  if (normalized.has("package.json")) add("Node.js package", "runtime", "HIGH", "package.json");
  if (normalized.has("pnpm-lock.yaml")) add("pnpm", "package-manager", "HIGH", "pnpm-lock.yaml");
  if (normalized.has("yarn.lock")) add("Yarn", "package-manager", "HIGH", "yarn.lock");
  if (normalized.has("bun.lock") || normalized.has("bun.lockb"))
    add("Bun", "package-manager", "HIGH", "Bun lockfile");
  if (normalized.has("cargo.toml")) add("Cargo", "package-manager", "HIGH", "Cargo.toml");
  if (normalized.has("pyproject.toml")) add("Python project", "runtime", "HIGH", "pyproject.toml");
  if (normalized.has("go.mod")) add("Go modules", "package-manager", "HIGH", "go.mod");
  if (normalized.has("pom.xml")) add("Maven", "build", "HIGH", "pom.xml");
  if (normalized.has("build.gradle") || normalized.has("build.gradle.kts"))
    add("Gradle", "build", "HIGH", "Gradle build file");
  if ([...normalized].some((path) => /(^|\/)dockerfile$/i.test(path)))
    add("Docker", "infrastructure", "HIGH", "Dockerfile");
  if (
    [...normalized].some(
      (path) =>
        path.startsWith(".github/workflows/") && (path.endsWith(".yml") || path.endsWith(".yaml")),
    )
  )
    add("GitHub Actions", "ci", "HIGH", ".github/workflows");
  if (normalized.has("turbo.json")) add("Turborepo", "monorepo", "HIGH", "turbo.json");

  const packageJson = manifests["package.json"];
  if (packageJson) {
    try {
      const manifest = JSON.parse(packageJson) as Record<string, unknown>;
      const dependencies = {
        ...asRecord(manifest.dependencies),
        ...asRecord(manifest.devDependencies),
      };
      if ("react" in dependencies) add("React", "framework", "HIGH", "package.json dependency");
      if ("next" in dependencies) add("Next.js", "framework", "HIGH", "package.json dependency");
      if ("vue" in dependencies) add("Vue", "framework", "HIGH", "package.json dependency");
      if ("svelte" in dependencies) add("Svelte", "framework", "HIGH", "package.json dependency");
      if ("vitest" in dependencies) add("Vitest", "testing", "HIGH", "package.json dependency");
      if ("@playwright/test" in dependencies || "playwright" in dependencies)
        add("Playwright", "testing", "HIGH", "package.json dependency");
      if ("typescript" in dependencies)
        add("TypeScript", "language-tooling", "HIGH", "package.json dependency");
    } catch {
      add("package.json", "manifest", "LOW", "Manifest was present but could not be parsed");
    }
  }
  return detections;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function detectQualitySignals(paths: string[]): Record<string, boolean | null> {
  const lower = paths.map((path) => path.toLowerCase());
  const baseNames = new Set(lower.map((path) => path.split("/").at(-1) ?? path));
  return {
    readme: [...baseNames].some((name) => /^readme(?:\.|$)/.test(name)),
    license: [...baseNames].some((name) => /^(license|copying)(?:\.|$)/.test(name)),
    contributing: [...baseNames].some((name) => /^contributing(?:\.|$)/.test(name)),
    codeOfConduct: [...baseNames].some((name) => /^code_of_conduct(?:\.|$)/.test(name)),
    security: [...baseNames].some((name) => /^security(?:\.|$)/.test(name)),
    tests: lower.some(
      (path) =>
        /(^|\/)(test|tests|spec|specs)(\/|$)/.test(path) || /\.(test|spec)\.[^.]+$/.test(path),
    ),
    ci: lower.some(
      (path) =>
        path.startsWith(".github/workflows/") ||
        path === ".gitlab-ci.yml" ||
        path === "circle.yml" ||
        path.startsWith(".circleci/"),
    ),
    docker: lower.some((path) => /(^|\/)dockerfile$/.test(path)),
  };
}
