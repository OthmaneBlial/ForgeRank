import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { eq, isNotNull } from "drizzle-orm";

import { classifyRepositoryTopics } from "@/application/classify-repository-topics";
import { recalculateDeveloper } from "@/application/recalculate-developer";
import { recalculateRepository } from "@/application/recalculate-repository";
import { refreshRepositoryRankings } from "@/application/refresh-rankings";
import { seedIdentifiers } from "@/application/seed";
import { TOPIC_DEFINITIONS } from "@/domain/topics";
import {
  REPOSITORY_QUALITY_SIGNAL_VERSION,
  TECHNOLOGY_DETECTION_VERSION,
  type RepositoryQualitySignals,
} from "@/domain/technology/analyze-tree";
import { closeDatabase, getDatabase } from "@/infrastructure/db/client";
import { persistDeveloperSnapshot } from "@/infrastructure/db/developer-store";
import { migrateDatabase } from "@/infrastructure/db/migrate";
import {
  gitAnalyses,
  rankingSnapshots,
  repositories,
  repositoryContributors,
  topics,
} from "@/infrastructure/db/schema";
import { persistRepositorySnapshot } from "@/infrastructure/db/repository-store";

const DAY_MS = 24 * 60 * 60 * 1_000;
const sampleProfile = process.env.FORGERANK_SAMPLE_PROFILE;
if (sampleProfile !== "e2e" && sampleProfile !== "demo") {
  throw new Error('Set FORGERANK_SAMPLE_PROFILE to either "e2e" or "demo".');
}

const sampleDirectory = path.resolve(
  process.cwd(),
  "data",
  sampleProfile === "e2e" ? "e2e-pglite" : "demo-pglite",
);
const configuredDirectory = process.env.FORGERANK_DATA_DIR
  ? path.resolve(process.env.FORGERANK_DATA_DIR)
  : null;
const sampleVersion = sampleProfile === "e2e" ? "e2e-fixture-v1" : "demo-sample-v1";
const sampleStrategy = sampleProfile === "e2e" ? "sanitized-e2e-fixture" : "synthetic-demo-sample";
const fixtureQualitySignals = {
  readme: true,
  license: true,
  contributing: true,
  codeOfConduct: true,
  security: true,
  tests: true,
  ci: true,
  docker: false,
  releaseAutomation: true,
  dependencyManagement: true,
  documentation: true,
} satisfies RepositoryQualitySignals;

if (configuredDirectory !== sampleDirectory) {
  throw new Error(
    `Refusing to prepare ${sampleProfile} data outside ${sampleDirectory}. Set FORGERANK_DATA_DIR to that exact path.`,
  );
}

type FixtureRepository = {
  fullName: string;
  description: string;
  language: string;
  stars: [number, number, number];
  forks: number;
  commits30d: number;
  commits90d: number;
  activeWeeks12: number;
  authors90d: number;
  topAuthorShare: number;
  technologies: Array<{
    name: string;
    category: string;
    confidence: string;
    evidence: string;
  }>;
};

const e2eFixtures: FixtureRepository[] = [
  {
    fullName: "sharkdp/bat",
    description: "A command-line developer tool with syntax highlighting.",
    language: "Rust",
    stars: [980, 1_280, 1_360],
    forks: 110,
    commits30d: 24,
    commits90d: 71,
    activeWeeks12: 10,
    authors90d: 7,
    topAuthorShare: 0.38,
    technologies: [
      { name: "Rust", category: "language", confidence: "HIGH", evidence: "Cargo.toml" },
      { name: "GitHub Actions", category: "ci", confidence: "HIGH", evidence: ".github/workflows" },
    ],
  },
  {
    fullName: "facebook/react",
    description: "A frontend user interface library for component-driven web applications.",
    language: "TypeScript",
    stars: [2_400, 2_430, 2_470],
    forks: 240,
    commits30d: 38,
    commits90d: 106,
    activeWeeks12: 12,
    authors90d: 14,
    topAuthorShare: 0.24,
    technologies: [
      { name: "React", category: "framework", confidence: "HIGH", evidence: "package.json" },
      { name: "TypeScript", category: "language", confidence: "HIGH", evidence: "tsconfig.json" },
    ],
  },
  {
    fullName: "sveltejs/svelte",
    description: "A frontend web framework and compiler for user interfaces.",
    language: "TypeScript",
    stars: [1_700, 1_745, 1_810],
    forks: 150,
    commits30d: 31,
    commits90d: 84,
    activeWeeks12: 11,
    authors90d: 10,
    topAuthorShare: 0.29,
    technologies: [
      { name: "Svelte", category: "framework", confidence: "HIGH", evidence: "package.json" },
      { name: "TypeScript", category: "language", confidence: "HIGH", evidence: "tsconfig.json" },
    ],
  },
  {
    fullName: "solidjs/solid",
    description: "A declarative frontend UI library for web applications.",
    language: "TypeScript",
    stars: [890, 925, 970],
    forks: 72,
    commits30d: 19,
    commits90d: 58,
    activeWeeks12: 9,
    authors90d: 6,
    topAuthorShare: 0.41,
    technologies: [
      { name: "TypeScript", category: "language", confidence: "HIGH", evidence: "tsconfig.json" },
      { name: "Vitest", category: "testing", confidence: "MEDIUM", evidence: "vitest.config.ts" },
    ],
  },
];

const demoFixtures: FixtureRepository[] = [
  {
    fullName: "demo-labs/atlas-cli",
    description: "A synthetic command-line toolkit used to demonstrate transparent ranking.",
    language: "Rust",
    stars: [980, 1_280, 1_360],
    forks: 110,
    commits30d: 24,
    commits90d: 71,
    activeWeeks12: 10,
    authors90d: 7,
    topAuthorShare: 0.38,
    technologies: [
      { name: "Rust", category: "language", confidence: "HIGH", evidence: "Cargo.toml" },
      { name: "GitHub Actions", category: "ci", confidence: "HIGH", evidence: ".github/workflows" },
    ],
  },
  {
    fullName: "demo-labs/relay-ui",
    description: "A fictional component library with a growing contributor cohort.",
    language: "TypeScript",
    stars: [2_400, 2_430, 2_470],
    forks: 240,
    commits30d: 38,
    commits90d: 106,
    activeWeeks12: 12,
    authors90d: 14,
    topAuthorShare: 0.24,
    technologies: [
      { name: "React", category: "framework", confidence: "HIGH", evidence: "package.json" },
      { name: "TypeScript", category: "language", confidence: "HIGH", evidence: "tsconfig.json" },
    ],
  },
  {
    fullName: "open-sample/pulse-kit",
    description: "A synthetic interface toolkit created for the isolated ForgeRank demo.",
    language: "TypeScript",
    stars: [1_700, 1_745, 1_810],
    forks: 150,
    commits30d: 31,
    commits90d: 84,
    activeWeeks12: 11,
    authors90d: 10,
    topAuthorShare: 0.29,
    technologies: [
      { name: "Svelte", category: "framework", confidence: "HIGH", evidence: "package.json" },
      { name: "TypeScript", category: "language", confidence: "HIGH", evidence: "tsconfig.json" },
    ],
  },
  {
    fullName: "open-sample/streamline",
    description: "A fictional reactive library used to exercise comparison and momentum views.",
    language: "TypeScript",
    stars: [890, 925, 970],
    forks: 72,
    commits30d: 19,
    commits90d: 58,
    activeWeeks12: 9,
    authors90d: 6,
    topAuthorShare: 0.41,
    technologies: [
      { name: "TypeScript", category: "language", confidence: "HIGH", evidence: "tsconfig.json" },
      { name: "Vitest", category: "testing", confidence: "MEDIUM", evidence: "vitest.config.ts" },
    ],
  },
];

const fixtures = sampleProfile === "e2e" ? e2eFixtures : demoFixtures;
const featuredRepository = fixtures[0]?.fullName;
const sampleDeveloper =
  sampleProfile === "e2e"
    ? {
        username: "sharkdp",
        displayName: "David Peter",
        bio: "Open-source command-line tool developer.",
        location: "Europe",
        sourceUrl: "https://github.com/sharkdp",
      }
    : {
        username: "demo-labs",
        displayName: "Sample Maintainer",
        bio: "Synthetic profile for the isolated ForgeRank demonstration.",
        location: "Demo dataset",
        sourceUrl: "https://github.com/demo-labs",
      };

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

async function prepare(): Promise<void> {
  await rm(sampleDirectory, { recursive: true, force: true });
  await mkdir(path.dirname(sampleDirectory), { recursive: true });
  await migrateDatabase();
  if (sampleProfile === "e2e") {
    await seedIdentifiers();
  } else {
    const taxonomyDatabase = await getDatabase();
    for (const topic of TOPIC_DEFINITIONS) {
      await taxonomyDatabase.insert(topics).values(topic).onConflictDoNothing();
    }
  }

  const database = await getDatabase();
  const now = new Date();
  for (const fixture of fixtures) {
    const [owner, name] = fixture.fullName.split("/") as [string, string];
    let repositoryId = "";
    for (const [index, days] of [40, 20, 0].entries()) {
      repositoryId = await persistRepositorySnapshot({
        owner,
        name,
        fullName: fixture.fullName,
        sourceUrl: `https://github.com/${fixture.fullName}`,
        description: fixture.description,
        homepage: null,
        primaryLanguage: fixture.language,
        license: "MIT",
        defaultBranch: "main",
        stars: fixture.stars[index] ?? fixture.stars.at(-1) ?? null,
        forks: fixture.forks,
        isFork: false,
        isArchived: false,
        observedAt: daysAgo(now, days),
        parserVersion: sampleVersion,
        confidence: "HIGH",
      });
    }

    const analyzedAt = daysAgo(now, 1);
    await database
      .update(repositories)
      .set({ repositoryCreatedAt: daysAgo(now, 900), nextRefreshAt: daysAgo(now, -2) })
      .where(eq(repositories.id, repositoryId));
    if (fixture.fullName === featuredRepository) {
      await database.insert(gitAnalyses).values({
        repositoryId,
        analyzedAt: daysAgo(now, 45),
        strategy: sampleStrategy,
        latestCommitAt: daysAgo(now, 50),
        oldestKnownCommitAt: daysAgo(now, 500),
        commits30d: 2,
        commits90d: 8,
        activeWeeks12: 2,
        previousDormantPeriodDays: null,
        uniqueAuthors90d: 2,
        topContributorShare: "0.600000",
        topThreeContributorShare: "1.000000",
        concentrationIndex: "0.520000",
        tagCount: 15,
        detectedTechnologies: fixture.technologies,
        technologyDetectionVersion: TECHNOLOGY_DETECTION_VERSION,
        qualitySignals: fixtureQualitySignals,
        qualitySignalsVersion: REPOSITORY_QUALITY_SIGNAL_VERSION,
        analysisVersion: sampleVersion,
      });
    }
    await database.insert(gitAnalyses).values({
      repositoryId,
      analyzedAt,
      strategy: sampleStrategy,
      latestCommitAt: daysAgo(now, 2),
      oldestKnownCommitAt: daysAgo(now, 365),
      commits30d: fixture.commits30d,
      commits90d: fixture.commits90d,
      activeWeeks12: fixture.activeWeeks12,
      previousDormantPeriodDays: fixture.fullName === featuredRepository ? 210 : null,
      uniqueAuthors90d: fixture.authors90d,
      topContributorShare: String(fixture.topAuthorShare),
      topThreeContributorShare: String(Math.min(0.9, fixture.topAuthorShare + 0.32)),
      concentrationIndex: "0.180000",
      tagCount: 18,
      detectedTechnologies: fixture.technologies,
      technologyDetectionVersion: TECHNOLOGY_DETECTION_VERSION,
      qualitySignals: fixtureQualitySignals,
      qualitySignalsVersion: REPOSITORY_QUALITY_SIGNAL_VERSION,
      readmeAnalysis: {
        path: "README.md",
        sizeBytes: 8_432,
        lineCount: 185,
        sectionCount: 8,
        sections: ["Overview", "Installation", "Usage", "Configuration", "Documentation"],
        badgeCount: 3,
        hasInstallationSection: true,
        documentationLinkCount: 2,
        contentInspected: true,
        confidence: "HIGH",
        version: "readme-structure-v1",
      },
      analysisVersion: sampleVersion,
    });

    if (fixture.fullName === featuredRepository) {
      await database.insert(repositoryContributors).values([
        {
          repositoryId,
          contributorKey: "e2e-author-1",
          displayName: sampleProfile === "e2e" ? "Fixture Author One" : "Sample Contributor One",
          commits: 27,
          firstCommitAt: daysAgo(now, 80),
          lastCommitAt: daysAgo(now, 2),
        },
        {
          repositoryId,
          contributorKey: "e2e-author-2",
          displayName: sampleProfile === "e2e" ? "Fixture Author Two" : "Sample Contributor Two",
          commits: 19,
          firstCommitAt: daysAgo(now, 70),
          lastCommitAt: daysAgo(now, 3),
        },
      ]);
    }

    await classifyRepositoryTopics(repositoryId);
    await recalculateRepository(repositoryId);
  }

  const developerId = await persistDeveloperSnapshot({
    username: sampleDeveloper.username,
    displayName: sampleDeveloper.displayName,
    bio: sampleDeveloper.bio,
    location: sampleDeveloper.location,
    avatarUrl: null,
    sourceUrl: sampleDeveloper.sourceUrl,
    observedAt: now,
    parserVersion: sampleVersion,
    confidence: "HIGH",
  });
  await recalculateDeveloper(developerId);
  const ranked = await refreshRepositoryRankings();
  const rankedRepositories = await database
    .select({
      id: repositories.id,
      fullName: repositories.fullName,
      score: repositories.currentScore,
    })
    .from(repositories)
    .where(isNotNull(repositories.rank));
  const rankedByName = new Map(
    rankedRepositories.map((repository) => [repository.fullName, repository]),
  );
  const [firstName, secondName, thirdName, fourthName] = fixtures.map(
    (fixture) => fixture.fullName,
  );
  if (!firstName || !secondName || !thirdName || !fourthName) {
    throw new Error("Each sample profile must define exactly four repositories.");
  }
  const historicalRuns = [
    { daysAgo: 31, order: [fourthName, firstName, thirdName, secondName] },
    { daysAgo: 8, order: [secondName, fourthName, firstName, thirdName] },
    { daysAgo: 2, order: [secondName, thirdName, fourthName, firstName] },
  ];
  for (const run of historicalRuns) {
    const calculatedAt = daysAgo(now, run.daysAgo);
    for (const [index, fullName] of run.order.entries()) {
      const repository = rankedByName.get(fullName);
      if (!repository?.score) continue;
      await database.insert(rankingSnapshots).values({
        scope: "global",
        period: "all",
        repositoryId: repository.id,
        rank: index + 1,
        score: repository.score,
        calculatedAt,
        rankingVersion: sampleVersion,
      });
    }
  }

  process.stdout.write(
    `Prepared isolated ${sampleProfile} sample: repositories=${fixtures.length} developer=${sampleDeveloper.username} ranked=${ranked} network=unused directory=${sampleDirectory}.\n`,
  );
}

try {
  await prepare();
} finally {
  await closeDatabase();
}
