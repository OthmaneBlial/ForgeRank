export type TopicDefinition = {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
  strongPhrases: string[];
  technologies: string[];
};

export const TOPIC_DEFINITIONS: TopicDefinition[] = [
  {
    slug: "ai",
    name: "AI",
    description: "Artificial intelligence tools, models, and infrastructure.",
    keywords: ["artificial intelligence", "generative ai", "neural", "inference"],
    strongPhrases: ["ai platform", "ai framework"],
    technologies: ["PyTorch", "TensorFlow"],
  },
  {
    slug: "ai-agents",
    name: "AI Agents",
    description: "Autonomous and assisted agent systems.",
    keywords: ["agentic", "multi-agent", "tool calling"],
    strongPhrases: ["ai agent", "coding agent"],
    technologies: [],
  },
  {
    slug: "llm",
    name: "LLM",
    description: "Large language model runtimes, tooling, and applications.",
    keywords: ["language model", "transformer", "prompt"],
    strongPhrases: ["large language model", "llm", "local ai"],
    technologies: [],
  },
  {
    slug: "databases",
    name: "Databases",
    description: "Database engines, storage layers, and query systems.",
    keywords: ["query engine", "storage engine", "sql", "nosql"],
    strongPhrases: ["database", "data store"],
    technologies: ["PostgreSQL", "Redis"],
  },
  {
    slug: "developer-tools",
    name: "Developer Tools",
    description: "Tools that improve building, debugging, and shipping software.",
    keywords: ["compiler", "linter", "formatter", "bundler", "build tool", "developer experience"],
    strongPhrases: ["developer tool", "toolchain"],
    technologies: ["Turborepo", "TypeScript"],
  },
  {
    slug: "frontend",
    name: "Frontend",
    description: "Browser UI frameworks, libraries, and design infrastructure.",
    keywords: ["user interface", "frontend", "web ui", "browser"],
    strongPhrases: ["ui library", "component library"],
    technologies: ["React", "Vue", "Svelte", "Next.js"],
  },
  {
    slug: "backend",
    name: "Backend",
    description: "Servers, APIs, and backend application frameworks.",
    keywords: ["server", "backend", "microservice"],
    strongPhrases: ["web api", "api framework"],
    technologies: ["Go modules", "Maven", "Gradle"],
  },
  {
    slug: "devops",
    name: "DevOps",
    description: "Infrastructure automation, deployment, and operations.",
    keywords: ["deployment", "infrastructure", "kubernetes", "terraform"],
    strongPhrases: ["devops", "infrastructure as code"],
    technologies: ["Docker"],
  },
  {
    slug: "security",
    name: "Security",
    description: "Defensive security tools and security engineering.",
    keywords: ["vulnerability", "encryption", "authentication", "authorization"],
    strongPhrases: ["cybersecurity", "security scanner"],
    technologies: [],
  },
  {
    slug: "observability",
    name: "Observability",
    description: "Metrics, tracing, logging, and production visibility.",
    keywords: ["telemetry", "tracing", "metrics", "logging"],
    strongPhrases: ["observability", "application monitoring"],
    technologies: [],
  },
  {
    slug: "mobile",
    name: "Mobile",
    description: "Native and cross-platform mobile development.",
    keywords: ["android", "ios", "mobile app"],
    strongPhrases: ["react native", "cross-platform mobile"],
    technologies: [],
  },
  {
    slug: "data-engineering",
    name: "Data Engineering",
    description: "Pipelines, analytics, and large-scale data systems.",
    keywords: ["data pipeline", "etl", "analytics", "data warehouse"],
    strongPhrases: ["data engineering", "stream processing"],
    technologies: [],
  },
  {
    slug: "machine-learning",
    name: "Machine Learning",
    description: "Machine learning frameworks, models, and tooling.",
    keywords: ["deep learning", "neural network", "model training"],
    strongPhrases: ["machine learning"],
    technologies: ["PyTorch", "TensorFlow"],
  },
  {
    slug: "game-development",
    name: "Game Development",
    description: "Game engines, tooling, and interactive simulation.",
    keywords: ["game engine", "gamedev", "rendering engine"],
    strongPhrases: ["game development"],
    technologies: [],
  },
  {
    slug: "cli",
    name: "CLI",
    description: "Command-line applications and terminal tooling.",
    keywords: ["terminal", "shell", "command line"],
    strongPhrases: ["command-line", "cli tool"],
    technologies: [],
  },
  {
    slug: "web-frameworks",
    name: "Web Frameworks",
    description: "Frameworks for building web applications and APIs.",
    keywords: ["web application", "web framework", "full-stack"],
    strongPhrases: ["react framework", "application framework"],
    technologies: ["Next.js", "React", "Vue", "Svelte"],
  },
  {
    slug: "testing",
    name: "Testing",
    description: "Automated testing frameworks, runners, and quality tooling.",
    keywords: ["test runner", "unit test", "end-to-end test"],
    strongPhrases: ["testing framework", "browser testing"],
    technologies: ["Vitest", "Playwright"],
  },
  {
    slug: "local-first",
    name: "Local-first",
    description: "Software that prioritizes local ownership and offline capability.",
    keywords: ["offline-first", "sync engine", "conflict-free"],
    strongPhrases: ["local-first", "local first"],
    technologies: [],
  },
  {
    slug: "self-hosted",
    name: "Self-hosted",
    description: "Software designed for operators to run on their own infrastructure.",
    keywords: ["on-premise", "on premises"],
    strongPhrases: ["self-hosted", "self hosted"],
    technologies: ["Docker"],
  },
];

export type TopicClassification = {
  slug: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
};

export function classifyTopics(input: {
  description: string | null;
  technologies: string[];
}): TopicClassification[] {
  const description = input.description?.toLowerCase() ?? "";
  return TOPIC_DEFINITIONS.map((definition) => {
    const keywordMatches = definition.keywords.filter((keyword) =>
      includesPhrase(description, keyword),
    );
    const strongMatches = definition.strongPhrases.filter((phrase) =>
      includesPhrase(description, phrase),
    );
    const technologyMatches = definition.technologies.filter((technology) =>
      input.technologies.includes(technology),
    );
    const score = keywordMatches.length + strongMatches.length * 2 + technologyMatches.length * 2;
    if (score < 2) return null;
    const evidence = [
      ...strongMatches,
      ...keywordMatches,
      ...technologyMatches.map((technology) => `${technology} detected`),
    ]
      .slice(0, 3)
      .join(", ");
    return {
      slug: definition.slug,
      confidence:
        score >= 4 ? ("HIGH" as const) : score >= 2 ? ("MEDIUM" as const) : ("LOW" as const),
      evidence,
    };
  }).filter((classification): classification is TopicClassification => classification !== null);
}

function includesPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}
