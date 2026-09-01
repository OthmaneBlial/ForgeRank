#!/usr/bin/env node

import path from "node:path";

import { closeDatabase, getDatabase } from "@/infrastructure/db/client";
import {
  crawlJobs,
  developerProfileEvents,
  developers,
  repositories,
} from "@/infrastructure/db/schema";
import { migrateDatabase } from "@/infrastructure/db/migrate";
import { IndexRepositoryService } from "@/application/index-repository";
import { seedIdentifiers } from "@/application/seed";
import { asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { recalculateRepository } from "@/application/recalculate-repository";
import { refreshRepositoryRankings } from "@/application/refresh-rankings";
import { GitInspector } from "@/infrastructure/git/inspector";
import { classifyRepositoryTopics } from "@/application/classify-repository-topics";
import { IndexDeveloperService } from "@/application/index-developer";
import {
  enforceGitCacheQuota,
  gitCacheLimitBytes,
  inspectGitCache,
} from "@/infrastructure/git/cache-manager";
import { scheduleRepositoryRefreshes } from "@/application/schedule-refreshes";
import { requestRepositoryRefresh } from "@/application/request-repository-refresh";
import { recalculateDeveloper } from "@/application/recalculate-developer";
import {
  recordDeveloperProfileCorrection,
  setDeveloperProfileVisibility,
} from "@/application/developer-profile-controls";
import { maintainSnapshots } from "@/application/maintain-snapshots";
import { takeLanguageEcosystemSnapshots } from "@/application/take-ecosystem-snapshots";
import { getLatestWorkerHealth } from "@/infrastructure/observability/worker-health";

function printHelp(): void {
  const executable = process.env.FORGERANK_DISTRIBUTION === "npm" ? "forgerank" : "pnpm forge";
  process.stdout.write(`ForgeRank operations CLI

Usage:
  ${executable} db migrate
  ${executable} seed
  ${executable} index owner/repository [--force]
  ${executable} index-user username [--force]
  ${executable} inspect owner/repository
  ${executable} refresh owner/repository
  ${executable} schedule [--limit 25]
  ${executable} bootstrap [--limit 12]
  ${executable} recalculate [--all]
  ${executable} recalculate-users
  ${executable} rank
  ${executable} developer-hide username --reason "verified request"
  ${executable} developer-show username --reason "approved restoration"
  ${executable} developer-correct username display-name|bio|location set|hide|revert [value] --reason "verified correction"
  ${executable} developer-audit username
  ${executable} ecosystem-snapshot
  ${executable} snapshot-maintenance [--apply]
  ${executable} cache-status
  ${executable} cache-prune
  ${executable} queue-status
  ${executable} worker-health [--max-age 90]
  ${executable} parser-test

The CLI never requires or accepts GitHub credentials.
`);
}

async function run(): Promise<void> {
  const [command, argument, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "db" && argument === "migrate") {
    await migrateDatabase();
    process.stdout.write("Database migrations applied.\n");
    return;
  }

  if (command === "seed") {
    const result = await seedIdentifiers();
    process.stdout.write(
      `Seeded ${result.repositories} repository identifiers, ${result.developers} developer identifiers, ${result.collections} collections, and ${result.topics} topics.\n`,
    );
    return;
  }

  if (command === "index" && argument) {
    const result = await new IndexRepositoryService().execute(argument, {
      force: rest.includes("--force"),
    });
    process.stdout.write(
      `${result.fullName}: stars=${result.stars ?? "unavailable"} forks=${result.forks ?? "unavailable"} confidence=${result.confidence}${result.cacheHit ? " cache=hit" : " cache=miss"}\n`,
    );
    return;
  }

  if (command === "index-user" && argument) {
    const result = await new IndexDeveloperService().execute(argument, {
      force: rest.includes("--force"),
    });
    process.stdout.write(
      `${result.username}: name=${result.displayName ?? "unavailable"} confidence=${result.confidence}${result.cacheHit ? " cache=hit" : " cache=miss"}\n`,
    );
    return;
  }

  if (command === "inspect" && argument) {
    const result = await new GitInspector().inspect(argument);
    await recalculateRepository(result.repositoryId);
    await classifyRepositoryTopics(result.repositoryId);
    process.stdout.write(
      `${result.fullName}: language=${result.primaryLanguage ?? "unavailable"} commits90d=${result.commits90d} authors90d=${result.uniqueAuthors90d} technologies=${result.technologies.join(", ") || "none"}${result.treeTruncated ? " tree=truncated" : ""}\n`,
    );
    return;
  }

  if (command === "refresh" && argument) {
    const identity = argument.split("/");
    if (identity.length !== 2 || !identity[0] || !identity[1])
      throw new Error("Use owner/repository for refresh requests.");
    const result = await requestRepositoryRefresh(identity[0], identity[1]);
    if (result.status === "NOT_FOUND")
      throw new Error(`${argument} is not in the ForgeRank index.`);
    process.stdout.write(
      result.status === "QUEUED"
        ? `${result.fullName}: refresh queued at priority ${result.priority}.\n`
        : `${result.fullName}: refresh already pending or inside its cooldown.\n`,
    );
    return;
  }

  if (command === "schedule") {
    const limitIndex = process.argv.indexOf("--limit");
    const rawLimit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : undefined;
    const report = await scheduleRepositoryRefreshes({
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    });
    process.stdout.write(
      `Refresh schedule: evaluated=${report.evaluated} due=${report.due} selected=${report.selected} queued=${report.queued} already-queued=${report.alreadyQueued} tiers=hot:${report.tiers.HOT},active:${report.tiers.ACTIVE},normal:${report.tiers.NORMAL},cold:${report.tiers.COLD}.\n`,
    );
    return;
  }

  if (command === "bootstrap") {
    const database = await getDatabase();
    const limitIndex = process.argv.indexOf("--limit");
    const rawLimit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 12;
    const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 12;
    const targets = await database
      .select({ fullName: repositories.fullName })
      .from(repositories)
      .where(isNull(repositories.lastSuccessfulFetchAt))
      .orderBy(asc(repositories.discoveredAt))
      .limit(limit);
    const service = new IndexRepositoryService();
    for (const [index, target] of targets.entries()) {
      process.stdout.write(`[${index + 1}/${targets.length}] ${target.fullName}\n`);
      try {
        await service.execute(target.fullName);
      } catch (error) {
        process.stderr.write(
          `  skipped: ${error instanceof Error ? error.message : "unknown indexing error"}\n`,
        );
      }
    }
    const ranked = await refreshRepositoryRankings();
    process.stdout.write(`Ranked ${ranked} indexed repositories.\n`);
    return;
  }

  if (command === "recalculate") {
    const database = await getDatabase();
    const indexed =
      argument === "--all" || rest.includes("--all")
        ? await database
            .select({ id: repositories.id, fullName: repositories.fullName })
            .from(repositories)
        : await database
            .select({ id: repositories.id, fullName: repositories.fullName })
            .from(repositories)
            .where(isNull(repositories.currentScore));
    for (const target of indexed) {
      await recalculateRepository(target.id);
      process.stdout.write(`Recalculated ${target.fullName}.\n`);
    }
    return;
  }

  if (command === "recalculate-users") {
    const database = await getDatabase();
    const indexed = await database
      .select({ id: developers.id, username: developers.username })
      .from(developers)
      .where(isNotNull(developers.lastIndexedAt))
      .orderBy(asc(developers.username));
    for (const target of indexed) {
      await recalculateDeveloper(target.id);
      process.stdout.write(`Recalculated @${target.username}.\n`);
    }
    return;
  }

  if ((command === "developer-hide" || command === "developer-show") && argument) {
    const reason = optionValue(rest, "--reason");
    const result = await setDeveloperProfileVisibility(
      argument,
      command === "developer-hide" ? "HIDDEN" : "PUBLIC",
      reason,
    );
    process.stdout.write(
      `@${result.username}: visibility=${result.visibility.toLowerCase()} at ${result.changedAt.toISOString()}.\n`,
    );
    return;
  }

  if (command === "developer-correct" && argument) {
    const [rawField, rawAction, possibleValue] = rest;
    const field = ({ "display-name": "DISPLAY_NAME", bio: "BIO", location: "LOCATION" } as const)[
      rawField as "display-name" | "bio" | "location"
    ];
    const action = ({ set: "SET_FIELD", hide: "HIDE_FIELD", revert: "REVERT_FIELD" } as const)[
      rawAction as "set" | "hide" | "revert"
    ];
    if (!field || !action)
      throw new Error(
        'Use: developer-correct username display-name|bio|location set|hide|revert [value] --reason "..."',
      );
    const reason = optionValue(rest, "--reason");
    const value = action === "SET_FIELD" && possibleValue !== "--reason" ? possibleValue : null;
    const result = await recordDeveloperProfileCorrection({
      username: argument,
      field,
      action,
      value,
      reason,
    });
    process.stdout.write(
      `@${result.username}: ${result.event.action.toLowerCase()} ${result.event.field?.toLowerCase()} recorded at ${result.event.createdAt.toISOString()}.\n`,
    );
    return;
  }

  if (command === "developer-audit" && argument) {
    const database = await getDatabase();
    const [developer] = await database
      .select()
      .from(developers)
      .where(eq(developers.canonicalUsername, argument.toLowerCase()))
      .limit(1);
    if (!developer) throw new Error(`Unknown developer ${argument}.`);
    process.stdout.write(
      `@${developer.username}: visibility=${developer.visibility.toLowerCase()}${developer.visibilityUpdatedAt ? ` updated=${developer.visibilityUpdatedAt.toISOString()}` : ""}\n`,
    );
    const events = await database
      .select()
      .from(developerProfileEvents)
      .where(eq(developerProfileEvents.developerId, developer.id))
      .orderBy(desc(developerProfileEvents.createdAt));
    for (const event of events)
      process.stdout.write(
        `${event.createdAt.toISOString()} ${event.action.toLowerCase()}${event.field ? ` ${event.field.toLowerCase()}` : ""} reason=${event.reason}\n`,
      );
    return;
  }

  if (command === "ecosystem-snapshot") {
    const report = await takeLanguageEcosystemSnapshots();
    process.stdout.write(
      `Captured ${report.ecosystems} language ecosystem snapshots at ${report.observedAt.toISOString()}.\n`,
    );
    return;
  }

  if (command === "snapshot-maintenance") {
    const report = await maintainSnapshots({
      apply: argument === "--apply" || rest.includes("--apply"),
    });
    process.stdout.write(
      `Snapshot maintenance ${report.mode.toLowerCase()}: full-resolution=${report.policy.fullResolutionDays}d daily-through=${report.policy.dailyResolutionDays}d.\n`,
    );
    for (const [name, values] of Object.entries({
      repositories: report.repositories,
      developers: report.developers,
      rankings: report.rankings,
      ecosystems: report.ecosystems,
    }))
      process.stdout.write(
        `${name}: considered=${values.considered} retained=${values.retained} removable=${values.removable} removed=${values.removed}\n`,
      );
    return;
  }

  if (command === "rank") {
    const count = await refreshRepositoryRankings();
    process.stdout.write(`Ranked ${count} repositories.\n`);
    return;
  }

  if (command === "cache-status" || command === "cache-prune") {
    const cacheRoot =
      process.env.GIT_CACHE_DIR ??
      path.join(process.env.FORGERANK_DATA_DIR ?? path.join(process.cwd(), "data"), "git-cache");
    const maximumBytes = gitCacheLimitBytes();
    if (command === "cache-prune") {
      const report = await enforceGitCacheQuota(cacheRoot, maximumBytes);
      process.stdout.write(
        `Git cache: ${formatBytes(report.afterBytes)} / ${formatBytes(maximumBytes)}; removed ${report.removed.length} inactive repositories${report.overLimit ? "; active cache entries still exceed the limit" : ""}.\n`,
      );
    } else {
      const report = await inspectGitCache(cacheRoot);
      process.stdout.write(
        `Git cache: ${formatBytes(report.bytes)} / ${formatBytes(maximumBytes)} across ${report.repositories} repositories.\n`,
      );
    }
    return;
  }

  if (command === "queue-status") {
    const database = await getDatabase();
    const statuses = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"];
    for (const status of statuses) {
      const rows = await database
        .select({ id: crawlJobs.id })
        .from(crawlJobs)
        .where(eq(crawlJobs.status, status));
      process.stdout.write(`${status.toLowerCase()}: ${rows.length}\n`);
    }
    return;
  }

  if (command === "worker-health") {
    const maximumAge = Math.max(20, Number(optionValueOrDefault(rest, "--max-age", "90")) || 90);
    const health = await getLatestWorkerHealth(maximumAge);
    process.stdout.write(
      `worker=${health.workerId ?? "none"} state=${health.state} age=${health.ageSeconds ?? "unavailable"}s max=${maximumAge}s\n`,
    );
    if (health.state !== "healthy") process.exitCode = 1;
    return;
  }

  if (command === "parser-test") {
    process.stdout.write("Run `pnpm test src/infrastructure/github-public/parser.test.ts`.\n");
    return;
  }

  throw new Error(`Unknown command: ${[command, argument].filter(Boolean).join(" ")}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

function optionValue(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function optionValueOrDefault(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return !value || value.startsWith("--") ? fallback : value;
}

run()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
