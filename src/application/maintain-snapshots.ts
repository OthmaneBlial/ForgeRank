import { inArray, lt } from "drizzle-orm";

import { DEFAULT_SNAPSHOT_RETENTION, planSnapshotRetention } from "@/domain/snapshot-retention";
import { getDatabase } from "@/infrastructure/db/client";
import {
  developerSnapshots,
  ecosystemSnapshots,
  rankingSnapshots,
  repositorySnapshots,
} from "@/infrastructure/db/schema";

type SnapshotMaintenanceCount = {
  considered: number;
  retained: number;
  removable: number;
  removed: number;
};
export type SnapshotMaintenanceReport = {
  mode: "DRY_RUN" | "APPLIED";
  policy: typeof DEFAULT_SNAPSHOT_RETENTION;
  repositories: SnapshotMaintenanceCount;
  developers: SnapshotMaintenanceCount;
  rankings: SnapshotMaintenanceCount;
  ecosystems: SnapshotMaintenanceCount;
};

export async function maintainSnapshots(
  options: { apply?: boolean; now?: Date } = {},
): Promise<SnapshotMaintenanceReport> {
  const database = await getDatabase();
  const now = options.now ?? new Date();
  const cutoff = new Date(
    now.getTime() - DEFAULT_SNAPSHOT_RETENTION.fullResolutionDays * 86_400_000,
  );
  const [repositoryRows, developerRows, rankingRows, ecosystemRows] = await Promise.all([
    database
      .select({
        id: repositorySnapshots.id,
        entityKey: repositorySnapshots.repositoryId,
        observedAt: repositorySnapshots.observedAt,
      })
      .from(repositorySnapshots)
      .where(lt(repositorySnapshots.observedAt, cutoff)),
    database
      .select({
        id: developerSnapshots.id,
        entityKey: developerSnapshots.developerId,
        observedAt: developerSnapshots.observedAt,
      })
      .from(developerSnapshots)
      .where(lt(developerSnapshots.observedAt, cutoff)),
    database
      .select({
        id: rankingSnapshots.id,
        repositoryId: rankingSnapshots.repositoryId,
        scope: rankingSnapshots.scope,
        period: rankingSnapshots.period,
        observedAt: rankingSnapshots.calculatedAt,
      })
      .from(rankingSnapshots)
      .where(lt(rankingSnapshots.calculatedAt, cutoff)),
    database
      .select({
        id: ecosystemSnapshots.id,
        ecosystemType: ecosystemSnapshots.ecosystemType,
        ecosystemKey: ecosystemSnapshots.ecosystemKey,
        observedAt: ecosystemSnapshots.observedAt,
      })
      .from(ecosystemSnapshots)
      .where(lt(ecosystemSnapshots.observedAt, cutoff)),
  ]);
  const plans = {
    repositories: planSnapshotRetention(repositoryRows, now),
    developers: planSnapshotRetention(developerRows, now),
    rankings: planSnapshotRetention(
      rankingRows.map((row) => ({
        id: row.id,
        entityKey: `${row.scope}:${row.period}:${row.repositoryId}`,
        observedAt: row.observedAt,
      })),
      now,
    ),
    ecosystems: planSnapshotRetention(
      ecosystemRows.map((row) => ({
        id: row.id,
        entityKey: `${row.ecosystemType}:${row.ecosystemKey}`,
        observedAt: row.observedAt,
      })),
      now,
    ),
  };
  if (options.apply) {
    await database.transaction(async (transaction) => {
      for (const ids of batches(plans.repositories.removedIds))
        await transaction.delete(repositorySnapshots).where(inArray(repositorySnapshots.id, ids));
      for (const ids of batches(plans.developers.removedIds))
        await transaction.delete(developerSnapshots).where(inArray(developerSnapshots.id, ids));
      for (const ids of batches(plans.rankings.removedIds))
        await transaction.delete(rankingSnapshots).where(inArray(rankingSnapshots.id, ids));
      for (const ids of batches(plans.ecosystems.removedIds))
        await transaction.delete(ecosystemSnapshots).where(inArray(ecosystemSnapshots.id, ids));
    });
  }
  return {
    mode: options.apply ? "APPLIED" : "DRY_RUN",
    policy: DEFAULT_SNAPSHOT_RETENTION,
    repositories: count(
      repositoryRows.length,
      plans.repositories.removedIds.length,
      Boolean(options.apply),
    ),
    developers: count(
      developerRows.length,
      plans.developers.removedIds.length,
      Boolean(options.apply),
    ),
    rankings: count(rankingRows.length, plans.rankings.removedIds.length, Boolean(options.apply)),
    ecosystems: count(
      ecosystemRows.length,
      plans.ecosystems.removedIds.length,
      Boolean(options.apply),
    ),
  };
}

function count(considered: number, removable: number, applied: boolean): SnapshotMaintenanceCount {
  return {
    considered,
    retained: considered - removable,
    removable,
    removed: applied ? removable : 0,
  };
}

function batches(values: string[], size = 1_000): string[][] {
  const result: string[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}
