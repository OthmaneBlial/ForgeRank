import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

import { eq, sql } from "drizzle-orm";

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} failed with status ${result.status}.${detail ? `\n${detail}` : ""}`,
    );
  }
}

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a PostgreSQL test port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function verify(databaseUrl: string): Promise<void> {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_POOL_SIZE = "2";

  const [
    { migrateDatabase },
    { closeDatabase, getDatabase, getDatabaseDriver },
    schema,
    seed,
    queue,
    rateLimit,
    workerHealth,
    repositoryStore,
    topicClassification,
    repositoryCalculation,
    momentumMatrix,
    repositoryLeaderboard,
    readModel,
  ] = await Promise.all([
    import("@/infrastructure/db/migrate"),
    import("@/infrastructure/db/client"),
    import("@/infrastructure/db/schema"),
    import("@/application/seed"),
    import("@/infrastructure/queue/job-queue"),
    import("@/infrastructure/http/rate-limit"),
    import("@/infrastructure/observability/worker-health"),
    import("@/infrastructure/db/repository-store"),
    import("@/application/classify-repository-topics"),
    import("@/application/recalculate-repository"),
    import("@/application/momentum-matrix-read-model"),
    import("@/application/repository-leaderboard-read-model"),
    import("@/application/read-model"),
  ]);

  try {
    await migrateDatabase();
    await migrateDatabase();
    const seeded = await seed.seedIdentifiers();
    assert.deepEqual(seeded, { repositories: 62, developers: 10, collections: 4, topics: 19 });

    const database = await getDatabase();
    assert.equal(getDatabaseDriver(), "postgres");
    const [repositoryCount] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.repositories);
    const [developerCount] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.developers);
    const [collectionCount] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.collections);
    assert.equal(repositoryCount?.count, 62);
    assert.equal(developerCount?.count, 10);
    assert.equal(collectionCount?.count, 4);

    const observedAt = new Date();
    let matrixRepositoryId = "";
    for (const [index, daysAgo] of [40, 20, 0].entries()) {
      matrixRepositoryId = await repositoryStore.persistRepositorySnapshot({
        owner: "facebook",
        name: "react",
        fullName: "facebook/react",
        sourceUrl: "https://github.com/facebook/react",
        description: "A frontend UI library for component-driven web applications.",
        homepage: null,
        primaryLanguage: "TypeScript",
        license: "MIT",
        defaultBranch: "main",
        stars: [1_000, 1_050, 1_110][index] ?? null,
        forks: 120,
        isFork: false,
        isArchived: false,
        observedAt: new Date(observedAt.getTime() - daysAgo * 24 * 60 * 60 * 1_000),
        parserVersion: "postgres-audit-v1",
        confidence: "HIGH",
      });
    }
    assert.equal(await topicClassification.classifyRepositoryTopics(matrixRepositoryId), 1);
    await database.insert(schema.gitAnalyses).values({
      repositoryId: matrixRepositoryId,
      analyzedAt: new Date(observedAt.getTime() - 45 * 24 * 60 * 60 * 1_000),
      strategy: "postgres-audit",
      latestCommitAt: new Date(observedAt.getTime() - 50 * 24 * 60 * 60 * 1_000),
      oldestKnownCommitAt: new Date(observedAt.getTime() - 700 * 24 * 60 * 60 * 1_000),
      commits30d: 2,
      commits90d: 7,
      activeWeeks12: 2,
      previousDormantPeriodDays: null,
      uniqueAuthors90d: 2,
      tagCount: 10,
      analysisVersion: "postgres-audit-v2",
    });
    await database.insert(schema.gitAnalyses).values({
      repositoryId: matrixRepositoryId,
      analyzedAt: observedAt,
      strategy: "postgres-audit",
      latestCommitAt: observedAt,
      oldestKnownCommitAt: new Date(observedAt.getTime() - 700 * 24 * 60 * 60 * 1_000),
      commits30d: 18,
      commits90d: 42,
      activeWeeks12: 7,
      previousDormantPeriodDays: 210,
      uniqueAuthors90d: 5,
      tagCount: 13,
      readmeAnalysis: {
        path: "README.md",
        sizeBytes: 4_096,
        lineCount: 90,
        sectionCount: 4,
        sections: ["Overview", "Installation", "Documentation", "Contributing"],
        badgeCount: 2,
        hasInstallationSection: true,
        documentationLinkCount: 1,
        contentInspected: true,
        confidence: "HIGH",
        version: "readme-structure-v1",
      },
      analysisVersion: "postgres-audit-v2",
    });
    await repositoryCalculation.recalculateRepository(matrixRepositoryId);
    const [revivedRepository] = await database
      .select({ maturity: schema.repositories.maturity })
      .from(schema.repositories)
      .where(eq(schema.repositories.id, matrixRepositoryId));
    assert.equal(revivedRepository?.maturity, "REVIVED");
    const detail = await readModel.getRepositoryDetailReadModel("facebook", "react");
    assert.ok(detail);
    assert.ok(detail.repositoryEvents.some((event) => event.kind === "ACTIVITY_RESUMED"));
    assert.ok(detail.repositoryEvents.some((event) => event.kind === "NEW_TAGS_OBSERVED"));
    assert.equal(detail.gitAnalysis?.readmeAnalysis?.hasInstallationSection, true);
    const matrix = await momentumMatrix.getMomentumMatrixReadModel(
      {
        language: "TypeScript",
        topic: "frontend",
        age: "all",
        minimumStars: 900,
      },
      observedAt,
    );
    assert.equal(matrix.points.length, 1);
    assert.equal(matrix.points[0]?.repository.fullName, "facebook/react");
    assert.equal(matrix.points[0]?.growth30d, 110);
    assert.deepEqual(matrix.points[0]?.topicSlugs, ["frontend"]);
    assert.equal(matrix.coverage.growthAvailable, 1);

    const leaderboard = await repositoryLeaderboard.getRepositoryLeaderboardReadModel(
      {
        language: "TypeScript",
        sort: "growth",
        period: "30d",
        stars: "1k-5k",
        age: "all",
        status: "all",
        includeForks: false,
        page: 1,
      },
      observedAt,
    );
    assert.equal(leaderboard.entries.length, 1);
    assert.equal(leaderboard.entries[0]?.repository.fullName, "facebook/react");
    assert.equal(leaderboard.entries[0]?.growth.absolute, 110);
    assert.equal(leaderboard.coverage.filtered, 1);
    assert.equal(leaderboard.coverage.growthAvailable, 1);
    assert.equal(leaderboard.coverage.gitAnalyzed, 1);
    assert.equal(leaderboard.entries[0]?.commits90d, 42);

    const deduplicationKey = `postgres-audit:${randomUUID()}`;
    assert.equal(
      await queue.enqueueJob({
        type: "postgres_audit",
        deduplicationKey,
        payload: { source: "production-adapter" },
      }),
      true,
    );
    const claimed = await queue.claimNextJob("postgres-audit-worker");
    assert.equal(claimed?.deduplicationKey, deduplicationKey);
    if (!claimed) throw new Error("The PostgreSQL queue did not return the inserted job.");
    await queue.completeJob(claimed.id);

    const firstLimit = await rateLimit.consumePersistentRateLimit({
      action: "postgres_audit",
      clientHash: randomUUID(),
      limit: 1,
      windowMs: 60_000,
    });
    const secondLimit = await rateLimit.consumePersistentRateLimit({
      action: "postgres_audit",
      clientHash: firstLimit.allowed ? "shared-window" : "unexpected",
      limit: 1,
      windowMs: 60_000,
    });
    const blockedLimit = await rateLimit.consumePersistentRateLimit({
      action: "postgres_audit",
      clientHash: firstLimit.allowed ? "shared-window" : "unexpected",
      limit: 1,
      windowMs: 60_000,
    });
    assert.equal(firstLimit.allowed, true);
    assert.equal(secondLimit.allowed, true);
    assert.equal(blockedLimit.allowed, false);

    await workerHealth.recordWorkerHeartbeat({ workerId: "postgres-audit", status: "RUNNING" });
    const heartbeat = await workerHealth.getLatestWorkerHealth(90);
    assert.equal(heartbeat.state, "healthy");
    assert.equal(heartbeat.workerId, "postgres-audit");
    await workerHealth.removeWorkerHeartbeat("postgres-audit");

    const tableResult = await database.execute(sql`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `);
    const extensionResult = await database.execute(sql`
      select exists(select 1 from pg_extension where extname = 'pg_trgm') as installed
    `);
    const tableRows = tableResult as unknown as Array<{ count: number }>;
    const extensionRows = extensionResult as unknown as Array<{ installed: boolean }>;
    assert.equal(tableRows[0]?.count, 22);
    assert.equal(extensionRows[0]?.installed, true);

    process.stdout.write(
      `PostgreSQL integration passed: driver=postgres tables=${tableRows[0]?.count} repositories=${repositoryCount?.count} matrix=filtered-growth leaderboard=filtered-growth lifecycle=revived timeline=derived queue=claimed rate-limit=blocked heartbeat=healthy pg_trgm=installed.\n`,
    );
  } finally {
    await closeDatabase();
  }
}

const configuredUrl = process.env.DATABASE_URL?.trim();
if (configuredUrl) {
  await verify(configuredUrl);
} else {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "forgerank-postgres-"));
  const dataDirectory = path.join(temporaryRoot, "cluster");
  const port = await availablePort();
  let started = false;

  try {
    run("initdb", [
      "-D",
      dataDirectory,
      "--auth-host=trust",
      "--auth-local=trust",
      "--encoding=UTF8",
      "--no-locale",
    ]);
    run("pg_ctl", [
      "-D",
      dataDirectory,
      "-l",
      path.join(temporaryRoot, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port}`,
      "-w",
      "start",
    ]);
    started = true;
    run("createdb", ["-h", "127.0.0.1", "-p", String(port), "forgerank_integration"]);
    const username = encodeURIComponent(process.env.USER ?? "postgres");
    await verify(`postgresql://${username}@127.0.0.1:${port}/forgerank_integration`);
  } finally {
    if (started) run("pg_ctl", ["-D", dataDirectory, "-m", "fast", "-w", "stop"]);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
